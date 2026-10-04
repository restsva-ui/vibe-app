-- VYBE — atomic and idempotent like / SuperVYBE flow.
-- Normal likes and SuperVYBE now share one transaction-safe RPC.
-- Only service_role may execute it.

create or replace function public.vybe_like_and_match(
  p_user_id uuid,
  p_target_user_id uuid,
  p_kind text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_existing_kind text;
  v_like_created boolean := false;
  v_like_upgraded boolean := false;
  v_super_charged boolean := false;
  v_reciprocal boolean := false;
  v_match_id uuid;
  v_match_created boolean := false;
  v_earned integer := 0;
  v_used integer := 0;
  v_balance integer := null;
begin
  if p_user_id is null or p_target_user_id is null or p_user_id = p_target_user_id then
    raise exception 'INVALID_TARGET';
  end if;
  if p_kind not in ('like','super') then
    raise exception 'INVALID_KIND';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = p_user_id and u.account_status = 'active'
  ) then
    raise exception 'USER_UNAVAILABLE';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = p_target_user_id and u.account_status = 'active'
  ) then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  if p_user_id::text < p_target_user_id::text then
    v_user_a := p_user_id;
    v_user_b := p_target_user_id;
  else
    v_user_a := p_target_user_id;
    v_user_b := p_user_id;
  end if;

  if p_kind = 'super' then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':supervybe', 0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_a::text || ':' || v_user_b::text || ':vybe-like', 0));

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_user_id and b.blocked_id = p_target_user_id)
       or (b.blocker_id = p_target_user_id and b.blocked_id = p_user_id)
  ) then
    raise exception 'USER_BLOCKED';
  end if;

  select m.id
  into v_match_id
  from public.matches m
  where m.user_a_id = v_user_a and m.user_b_id = v_user_b
  limit 1;

  if v_match_id is not null then
    if p_kind = 'super' then
      select
        coalesce((select sum(r.reward_amount) from public.referral_rewards r where r.user_id=p_user_id and r.reward_type='supervybe'),0)
        + coalesce((select sum(r.reward_amount) from public.paid_rewards r where r.user_id=p_user_id and r.reward_type='supervybe'),0),
        coalesce((select sum(u.reward_amount) from public.reward_uses u where u.user_id=p_user_id and u.reward_type='supervybe'),0)
      into v_earned, v_used;
      v_balance := v_earned - v_used;
    end if;

    return jsonb_build_object(
      'matched', true,
      'match_created', false,
      'match', jsonb_build_object('id', v_match_id),
      'like_created', false,
      'like_upgraded', false,
      'super_charged', false,
      'balance', v_balance
    );
  end if;

  select l.kind
  into v_existing_kind
  from public.likes l
  where l.from_user_id = p_user_id and l.to_user_id = p_target_user_id
  limit 1;

  if p_kind = 'super' then
    if v_existing_kind is distinct from 'super' then
      select
        coalesce((select sum(r.reward_amount) from public.referral_rewards r where r.user_id=p_user_id and r.reward_type='supervybe'),0)
        + coalesce((select sum(r.reward_amount) from public.paid_rewards r where r.user_id=p_user_id and r.reward_type='supervybe'),0),
        coalesce((select sum(u.reward_amount) from public.reward_uses u where u.user_id=p_user_id and u.reward_type='supervybe'),0)
      into v_earned, v_used;

      if v_earned - v_used < 1 then
        raise exception 'NO_SUPERVYBE';
      end if;

      if v_existing_kind is null then
        insert into public.likes(from_user_id,to_user_id,kind)
        values(p_user_id,p_target_user_id,'super')
        on conflict(from_user_id,to_user_id) do update set kind='super';
        v_like_created := true;
      else
        update public.likes
        set kind='super'
        where from_user_id=p_user_id and to_user_id=p_target_user_id;
        v_like_upgraded := true;
      end if;

      insert into public.reward_uses(user_id,reward_type,reward_amount)
      values(p_user_id,'supervybe',1);

      v_super_charged := true;
      v_used := v_used + 1;
      v_balance := v_earned - v_used;
    else
      select
        coalesce((select sum(r.reward_amount) from public.referral_rewards r where r.user_id=p_user_id and r.reward_type='supervybe'),0)
        + coalesce((select sum(r.reward_amount) from public.paid_rewards r where r.user_id=p_user_id and r.reward_type='supervybe'),0),
        coalesce((select sum(u.reward_amount) from public.reward_uses u where u.user_id=p_user_id and u.reward_type='supervybe'),0)
      into v_earned, v_used;

      v_balance := v_earned - v_used;
    end if;
  else
    if v_existing_kind is null then
      insert into public.likes(from_user_id,to_user_id,kind)
      values(p_user_id,p_target_user_id,'like')
      on conflict(from_user_id,to_user_id) do nothing;
      v_like_created := true;
    end if;
  end if;

  select exists(
    select 1 from public.likes l
    where l.from_user_id = p_target_user_id
      and l.to_user_id = p_user_id
  )
  into v_reciprocal;

  if v_reciprocal then
    insert into public.matches(user_a_id,user_b_id)
    values(v_user_a,v_user_b)
    on conflict(user_a_id,user_b_id) do nothing
    returning id into v_match_id;

    if v_match_id is not null then
      v_match_created := true;
    else
      select m.id
      into v_match_id
      from public.matches m
      where m.user_a_id=v_user_a and m.user_b_id=v_user_b
      limit 1;
    end if;
  end if;

  return jsonb_build_object(
    'matched', v_reciprocal,
    'match_created', v_match_created,
    'match', case when v_match_id is null then null else jsonb_build_object('id',v_match_id) end,
    'like_created', v_like_created,
    'like_upgraded', v_like_upgraded,
    'super_charged', v_super_charged,
    'balance', v_balance
  );
end;
$$;

revoke all on function public.vybe_like_and_match(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.vybe_like_and_match(uuid,uuid,text) to service_role;

create or replace function public.use_supervybe_and_like(
  p_user_id uuid,
  p_target_user_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select public.vybe_like_and_match(p_user_id,p_target_user_id,'super');
$$;

revoke all on function public.use_supervybe_and_like(uuid,uuid) from public, anon, authenticated;
grant execute on function public.use_supervybe_and_like(uuid,uuid) to service_role;
