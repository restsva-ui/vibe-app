-- VYBE social core v1: likes, matches and private messages
-- Apply once in Supabase SQL Editor. Safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  kind text not null default 'like' check (kind in ('like','super')),
  created_at timestamptz not null default now(),
  constraint likes_not_self check (from_user_id <> to_user_id),
  constraint likes_unique_pair unique (from_user_id, to_user_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.users(id) on delete cascade,
  user_b_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_not_self check (user_a_id <> user_b_id),
  constraint matches_canonical_order check (user_a_id::text < user_b_id::text),
  constraint matches_unique_pair unique (user_a_id, user_b_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists likes_to_user_idx on public.likes(to_user_id, created_at desc);
create index if not exists matches_user_a_idx on public.matches(user_a_id, created_at desc);
create index if not exists matches_user_b_idx on public.matches(user_b_id, created_at desc);
create index if not exists messages_match_created_idx on public.messages(match_id, created_at asc);

alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

-- Browser clients get no direct social-core access.
-- The verified Edge Function uses the service role and enforces ownership.
drop policy if exists "likes_select_anon" on public.likes;
drop policy if exists "likes_insert_anon" on public.likes;
drop policy if exists "likes_update_anon" on public.likes;
drop policy if exists "likes_delete_anon" on public.likes;
drop policy if exists "matches_select_anon" on public.matches;
drop policy if exists "matches_insert_anon" on public.matches;
drop policy if exists "matches_update_anon" on public.matches;
drop policy if exists "matches_delete_anon" on public.matches;
drop policy if exists "messages_select_anon" on public.messages;
drop policy if exists "messages_insert_anon" on public.messages;
drop policy if exists "messages_update_anon" on public.messages;
drop policy if exists "messages_delete_anon" on public.messages;

revoke all on table public.likes from anon, authenticated;
revoke all on table public.matches from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
