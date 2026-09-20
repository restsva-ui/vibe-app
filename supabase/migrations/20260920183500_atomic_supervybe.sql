-- VYBE: atomic SuperVYBE spend + like + reciprocal match.
-- The Edge Function calls this only with service_role.
-- pg_advisory_xact_lock serializes SuperVYBE spends per user to prevent double-spend races.

create or replace function public.use_supervybe_and_like(
  p_user_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned integer := 0;
  v_used integer := 0;
  v_existing_like uuid;
  v_reciprocal boolean := false;
  v_match_id uuid;
  v_user_a uuid;
  v_user_b uuid;
begin
  if p_user_id is null or p_target_user_id is null or p_user_id = p_target_user_id then
    raise exception 'INVALID_TARGET';
  end if;

  if not exists (select 1 from public.users where id = p_target_user_id) then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  -- Stable per-user transaction lock: concurrent taps cannot spend the same reward twice.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':supervybe', 0));

  select coalesce(sum(reward_amount), 0)::integer
    into v_earned
  from public.referral_rewards
  where user_id = p_user_id and reward_type = 'supervybe';

  select coalesce(sum(reward_amount), 0)::integer
    into v_used
  from public.reward_uses
  where user_id = p_user_id and reward_type = 'supervybe';

  if v_earned - v_used < 1 then
    raise exception 'NO_SUPERVYBE';
  end if;

  -- Re-sending SuperVYBE to the same person upgrades/keeps the existing like,
  -- but still intentionally consumes one SuperVYBE per explicit send.
  select id into v_existing_like
  from public.likes
  where from_user_id = p_user_id and to_user_id = p_target_user_id
  limit 1;

  if v_existing_like is null then
    insert into public.likes (from_user_id, to_user_id, kind)
    values (p_user_id, p_target_user_id, 'super');
  else
    update public.likes set kind = 'super' where id = v_existing_like;
  end if;

  insert into public.reward_uses (user_id, reward_type, reward_amount)
  values (p_user_id, 'supervybe', 1);

  select exists(
    select 1 from public.likes
    where from_user_id = p_target_user_id and to_user_id = p_user_id
  ) into v_reciprocal;

  if v_reciprocal then
    if p_user_id::text < p_target_user_id::text then
      v_user_a := p_user_id; v_user_b := p_target_user_id;
    else
      v_user_a := p_target_user_id; v_user_b := p_user_id;
    end if;

    select id into v_match_id
    from public.matches
    where user_a_id = v_user_a and user_b_id = v_user_b
    limit 1;

    if v_match_id is null then
      insert into public.matches (user_a_id, user_b_id)
      values (v_user_a, v_user_b)
      returning id into v_match_id;
    end if;
  end if;

  return jsonb_build_object(
    'matched', v_reciprocal,
    'match', case when v_match_id is null then null else jsonb_build_object('id', v_match_id) end,
    'balance', v_earned - v_used - 1
  );
end;
$$;

revoke all on function public.use_supervybe_and_like(uuid, uuid) from public, anon, authenticated;
grant execute on function public.use_supervybe_and_like(uuid, uuid) to service_role;
