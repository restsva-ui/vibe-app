-- VYBE production hardening 2026-10-02.
-- Architecture: Telegram Mini App -> telegram-auth Edge Function -> service-role Data API -> Postgres.
-- Browser clients do not access public tables directly.

-- 1) Remove permissive legacy anon policies. Direct table access remains server-only.
drop policy if exists vybe_users_read on public.users;
drop policy if exists vybe_users_insert on public.users;
drop policy if exists vybe_users_update on public.users;

drop policy if exists vybe_profiles_read on public.profiles;
drop policy if exists vybe_profiles_insert on public.profiles;
drop policy if exists vybe_profiles_update on public.profiles;

drop policy if exists vybe_intents_read on public.intents;
drop policy if exists vybe_intents_insert on public.intents;
drop policy if exists vybe_intents_update on public.intents;

-- Keep all VYBE application tables unreachable to anon/authenticated.
revoke all on table
  public.users,
  public.profiles,
  public.intents,
  public.likes,
  public.matches,
  public.messages,
  public.blocks,
  public.reports,
  public.referrals,
  public.referral_rewards,
  public.reward_uses,
  public.user_entitlements,
  public.match_reads
from anon, authenticated;

-- Edge Functions use the service role. Ensure moderation tables are available to it too.
grant select, insert, update, delete on table public.blocks, public.reports to service_role;

-- 2) Restrict internal SECURITY DEFINER event-trigger helper from Data API callers.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role;

-- 3) Prevent future objects created by postgres in public from being exposed by default.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- 4) Restore the missing atomic Spotlight RPC. It is service-role only.
create or replace function public.use_spotlight(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned integer := 0;
  v_used integer := 0;
  v_current timestamptz;
  v_until timestamptz;
begin
  if p_user_id is null
     or not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':spotlight', 0)
  );

  select coalesce(sum(reward_amount), 0)::integer
    into v_earned
  from public.referral_rewards
  where user_id = p_user_id
    and reward_type = 'spotlight';

  select coalesce(sum(reward_amount), 0)::integer
    into v_used
  from public.reward_uses
  where user_id = p_user_id
    and reward_type = 'spotlight';

  if v_earned - v_used < 1 then
    raise exception 'NO_SPOTLIGHT';
  end if;

  select spotlight_until
    into v_current
  from public.user_entitlements
  where user_id = p_user_id
  limit 1;

  v_until := greatest(now(), coalesce(v_current, now())) + interval '30 minutes';

  insert into public.reward_uses (user_id, reward_type, reward_amount)
  values (p_user_id, 'spotlight', 1);

  insert into public.user_entitlements (user_id, spotlight_until, updated_at)
  values (p_user_id, v_until, now())
  on conflict (user_id)
  do update set
    spotlight_until = excluded.spotlight_until,
    updated_at = now();

  return jsonb_build_object(
    'spotlight_until', v_until,
    'balance', v_earned - v_used - 1
  );
end;
$$;

revoke all on function public.use_spotlight(uuid) from public, anon, authenticated;
grant execute on function public.use_spotlight(uuid) to service_role;

-- 5) Add covering indexes for foreign keys used by moderation/chat queries.
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists reports_reporter_idx on public.reports(reporter_id);

-- 6) Remove known duplicate constraints/indexes, retaining the canonical migration names.
alter table public.likes drop constraint if exists likes_from_user_to_user_key;
alter table public.likes drop constraint if exists likes_check;
drop index if exists public.idx_messages_match_created;
