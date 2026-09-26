-- VYBE: atomic SuperVYBE spend + like + reciprocal match.
-- Service-role only. One DB transaction means any error rolls back the spend and like.
-- A per-user advisory transaction lock prevents concurrent double-spends.

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
  v_reciprocal boolean := false;
  v_match_id uuid;
  v_user_a uuid;
  v_user_b uuid;
begin
  if p_user_id is null
     or p_target_user_id is null
     or p_user_id = p_target_user_id then
    raise exception 'INVALID_TARGET';
  end if;

  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  if not exists (select 1 from public.users where id = p_target_user_id) then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':supervybe', 0)
  );

  select coalesce(sum(reward_amount), 0)::integer
    into v_earned
  from public.referral_rewards
  where user_id = p_user_id
    and reward_type = 'supervybe';

  select coalesce(sum(reward_amount), 0)::integer
    into v_used
  from public.reward_uses
  where user_id = p_user_id
    and reward_type = 'supervybe';

  if v_earned - v_used < 1 then
    raise exception 'NO_SUPERVYBE';
  end if;

  -- likes has a unique (from_user_id,to_user_id) constraint.
  -- Upgrade an existing normal like instead of creating a duplicate.
  insert into public.likes (from_user_id, to_user_id, kind)
  values (p_user_id, p_target_user_id, 'super')
  on conflict (from_user_id, to_user_id)
  do update set kind = 'super';

  -- Spend only after the like write succeeds; any later failure rolls back both.
  insert into public.reward_uses (user_id, reward_type, reward_amount)
  values (p_user_id, 'supervybe', 1);

  select exists(
    select 1
    from public.likes
    where from_user_id = p_target_user_id
      and to_user_id = p_user_id
  ) into v_reciprocal;

  if v_reciprocal then
    -- matches requires canonical UUID ordering.
    if p_user_id < p_target_user_id then
      v_user_a := p_user_id;
      v_user_b := p_target_user_id;
    else
      v_user_a := p_target_user_id;
      v_user_b := p_user_id;
    end if;

    -- matches has a unique canonical pair constraint.
    insert into public.matches (user_a_id, user_b_id)
    values (v_user_a, v_user_b)
    on conflict (user_a_id, user_b_id)
    do nothing;

    select id
      into v_match_id
    from public.matches
    where user_a_id = v_user_a
      and user_b_id = v_user_b
    limit 1;
  end if;

  return jsonb_build_object(
    'matched', v_reciprocal,
    'match',
      case
        when v_match_id is null then null
        else jsonb_build_object('id', v_match_id)
      end,
    'balance', v_earned - v_used - 1
  );
end;
$$;

revoke all on function public.use_supervybe_and_like(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.use_supervybe_and_like(uuid, uuid)
  to service_role;
