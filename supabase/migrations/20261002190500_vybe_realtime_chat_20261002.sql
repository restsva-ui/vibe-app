-- VYBE realtime chat v1.
-- Realtime channels are public but use unguessable UUID topics and broadcast only
-- minimal change signals; message bodies remain behind the Telegram-auth Edge Function.

alter table public.users
  add column if not exists realtime_topic uuid not null default gen_random_uuid();

alter table public.matches
  add column if not exists realtime_topic uuid not null default gen_random_uuid();

create unique index if not exists users_realtime_topic_key
  on public.users(realtime_topic);

create unique index if not exists matches_realtime_topic_key
  on public.matches(realtime_topic);

create or replace function public.vybe_broadcast_message_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic uuid;
begin
  select m.realtime_topic
    into v_topic
  from public.matches m
  where m.id = new.match_id;

  if v_topic is not null then
    perform realtime.send(
      jsonb_build_object(
        'sender_id', new.sender_id,
        'created_at', new.created_at
      ),
      'message_created',
      'vybe:match:' || v_topic::text,
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists vybe_messages_realtime on public.messages;
create trigger vybe_messages_realtime
after insert on public.messages
for each row
execute function public.vybe_broadcast_message_created();

create or replace function public.vybe_broadcast_read_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic uuid;
begin
  if tg_op = 'UPDATE' and new.last_read_at is not distinct from old.last_read_at then
    return new;
  end if;

  select m.realtime_topic
    into v_topic
  from public.matches m
  where m.id = new.match_id;

  if v_topic is not null then
    perform realtime.send(
      jsonb_build_object(
        'reader_id', new.user_id,
        'last_read_at', new.last_read_at
      ),
      'read_updated',
      'vybe:match:' || v_topic::text,
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists vybe_match_reads_realtime on public.match_reads;
create trigger vybe_match_reads_realtime
after insert or update of last_read_at on public.match_reads
for each row
execute function public.vybe_broadcast_read_updated();

create or replace function public.vybe_broadcast_match_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic_a uuid;
  v_topic_b uuid;
begin
  select u.realtime_topic into v_topic_a from public.users u where u.id = new.user_a_id;
  select u.realtime_topic into v_topic_b from public.users u where u.id = new.user_b_id;

  if v_topic_a is not null then
    perform realtime.send(
      jsonb_build_object('created_at', new.created_at),
      'match_created',
      'vybe:user:' || v_topic_a::text,
      false
    );
  end if;

  if v_topic_b is not null then
    perform realtime.send(
      jsonb_build_object('created_at', new.created_at),
      'match_created',
      'vybe:user:' || v_topic_b::text,
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists vybe_matches_realtime on public.matches;
create trigger vybe_matches_realtime
after insert on public.matches
for each row
execute function public.vybe_broadcast_match_created();

create or replace function public.vybe_broadcast_relationship_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocker uuid := coalesce(new.blocker_id, old.blocker_id);
  v_blocked uuid := coalesce(new.blocked_id, old.blocked_id);
  v_topic_a uuid;
  v_topic_b uuid;
begin
  select u.realtime_topic into v_topic_a from public.users u where u.id = v_blocker;
  select u.realtime_topic into v_topic_b from public.users u where u.id = v_blocked;

  if v_topic_a is not null then
    perform realtime.send(
      jsonb_build_object('changed_at', now()),
      'relationship_changed',
      'vybe:user:' || v_topic_a::text,
      false
    );
  end if;

  if v_topic_b is not null then
    perform realtime.send(
      jsonb_build_object('changed_at', now()),
      'relationship_changed',
      'vybe:user:' || v_topic_b::text,
      false
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists vybe_blocks_realtime on public.blocks;
create trigger vybe_blocks_realtime
after insert or delete on public.blocks
for each row
execute function public.vybe_broadcast_relationship_changed();

revoke execute on function public.vybe_broadcast_message_created()
  from public, anon, authenticated, service_role;
revoke execute on function public.vybe_broadcast_read_updated()
  from public, anon, authenticated, service_role;
revoke execute on function public.vybe_broadcast_match_created()
  from public, anon, authenticated, service_role;
revoke execute on function public.vybe_broadcast_relationship_changed()
  from public, anon, authenticated, service_role;
