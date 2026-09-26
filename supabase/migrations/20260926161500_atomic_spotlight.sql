-- VYBE: atomically spend one Spotlight reward and extend Spotlight by 30 minutes.
-- Service-role only. Advisory lock prevents concurrent double-spends.

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

revoke all on function public.use_spotlight(uuid)
  from public, anon, authenticated;

grant execute on function public.use_spotlight(uuid)
  to service_role;
