-- VYBE social core v1
-- Normalizes the existing MVP schema and hardens likes, matches and messages.
-- Safe for the current VYBE database inspected on 2026-09-19.

create extension if not exists pgcrypto;

-- Existing MVP columns are from_user/to_user and user_a/user_b.
-- Rename only when the old column exists and the normalized name does not.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='likes' and column_name='from_user')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='likes' and column_name='from_user_id') then
    alter table public.likes rename column from_user to from_user_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='likes' and column_name='to_user')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='likes' and column_name='to_user_id') then
    alter table public.likes rename column to_user to to_user_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='matches' and column_name='user_a')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='matches' and column_name='user_a_id') then
    alter table public.matches rename column user_a to user_a_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='matches' and column_name='user_b')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='matches' and column_name='user_b_id') then
    alter table public.matches rename column user_b to user_b_id;
  end if;
end $$;

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  kind text not null default 'like',
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.users(id) on delete cascade,
  user_b_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Normalize nullable/default metadata from the early MVP where needed.
alter table public.likes alter column kind set default 'like';
update public.likes set kind='like' where kind is null or kind not in ('like','super');
alter table public.likes alter column kind set not null;
alter table public.likes alter column created_at set default now();
update public.likes set created_at=now() where created_at is null;
alter table public.likes alter column created_at set not null;

alter table public.matches alter column created_at set default now();
update public.matches set created_at=now() where created_at is null;
alter table public.matches alter column created_at set not null;

alter table public.messages alter column created_at set default now();
update public.messages set created_at=now() where created_at is null;
alter table public.messages alter column created_at set not null;

-- Remove legacy duplicates before adding uniqueness.
delete from public.likes a using public.likes b
where a.from_user_id=b.from_user_id and a.to_user_id=b.to_user_id
  and (a.created_at>b.created_at or (a.created_at=b.created_at and a.id::text>b.id::text));

delete from public.matches a using public.matches b
where least(a.user_a_id::text,a.user_b_id::text)=least(b.user_a_id::text,b.user_b_id::text)
  and greatest(a.user_a_id::text,a.user_b_id::text)=greatest(b.user_a_id::text,b.user_b_id::text)
  and (a.created_at>b.created_at or (a.created_at=b.created_at and a.id::text>b.id::text));

-- Canonicalize match pair ordering.
update public.matches
set user_a_id=user_b_id, user_b_id=user_a_id
where user_a_id::text>user_b_id::text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.likes'::regclass and conname='likes_not_self') then
    alter table public.likes add constraint likes_not_self check (from_user_id<>to_user_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.likes'::regclass and conname='likes_kind_check') then
    alter table public.likes add constraint likes_kind_check check (kind in ('like','super'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.likes'::regclass and conname='likes_unique_pair') then
    alter table public.likes add constraint likes_unique_pair unique (from_user_id,to_user_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.matches'::regclass and conname='matches_not_self') then
    alter table public.matches add constraint matches_not_self check (user_a_id<>user_b_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.matches'::regclass and conname='matches_canonical_order') then
    alter table public.matches add constraint matches_canonical_order check (user_a_id::text<user_b_id::text);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.matches'::regclass and conname='matches_unique_pair') then
    alter table public.matches add constraint matches_unique_pair unique (user_a_id,user_b_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.messages'::regclass and conname='messages_body_length') then
    alter table public.messages add constraint messages_body_length check (char_length(btrim(body)) between 1 and 2000);
  end if;
end $$;

create index if not exists likes_to_user_idx on public.likes(to_user_id,created_at desc);
create index if not exists matches_user_a_idx on public.matches(user_a_id,created_at desc);
create index if not exists matches_user_b_idx on public.matches(user_b_id,created_at desc);
create index if not exists messages_match_created_idx on public.messages(match_id,created_at asc);

alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

-- Social-core access is server-only. Edge Function authenticates Telegram initData
-- and uses service role after deriving the actor from the verified Telegram user.
revoke all on table public.likes from anon, authenticated;
revoke all on table public.matches from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
