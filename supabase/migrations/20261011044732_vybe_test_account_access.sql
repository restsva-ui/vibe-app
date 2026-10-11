-- Revocable test access, separate from administrative roles and purchase ledgers.
create table if not exists private.vybe_test_access (
  user_id uuid primary key references public.users(id) on delete cascade,
  enabled boolean not null default true,
  granted_by uuid not null references public.users(id),
  granted_at timestamptz not null default now()
);
create index if not exists vybe_test_access_granted_by_idx on private.vybe_test_access(granted_by);
alter table private.vybe_test_access enable row level security;
revoke all on private.vybe_test_access from public, anon, authenticated;
grant select,insert,update,delete on private.vybe_test_access to service_role;
create or replace function public.vybe_has_test_access(p_user_id uuid)
returns boolean language sql stable security invoker set search_path=''
as $$ select exists(select 1 from private.vybe_test_access t
  join public.users u on u.id=t.user_id where t.user_id=p_user_id and t.enabled and u.account_status='active'); $$;
revoke all on function public.vybe_has_test_access(uuid) from public,anon,authenticated;
grant execute on function public.vybe_has_test_access(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.use_spotlight(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
  v_earned integer := 0;
  v_used integer := 0;
  v_current timestamptz;
  v_until timestamptz;
  v_owner boolean;
  v_test boolean;
  v_free boolean;
begin
  if p_user_id is null
     or not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':spotlight',0));

  select
    coalesce((select sum(reward_amount) from public.referral_rewards where user_id=p_user_id and reward_type='spotlight'),0)
    + coalesce((select sum(reward_amount) from public.paid_rewards where user_id=p_user_id and reward_type='spotlight'),0)
    into v_earned;

  select coalesce(sum(reward_amount),0)::integer into v_used
  from public.reward_uses
  where user_id=p_user_id and reward_type='spotlight';

  select exists(select 1 from public.admin_users where user_id=p_user_id and role='owner') into v_owner;
  v_test := public.vybe_has_test_access(p_user_id);
  v_free := v_owner or v_test;
  if not v_free and v_earned-v_used < 1 then raise exception 'NO_SPOTLIGHT'; end if;

  select spotlight_until into v_current
  from public.user_entitlements
  where user_id=p_user_id
  limit 1;

  v_until := greatest(now(),coalesce(v_current,now())) + interval '30 minutes';

  if not v_free then
    insert into public.reward_uses(user_id,reward_type,reward_amount) values(p_user_id,'spotlight',1);
  end if;

  insert into public.user_entitlements(user_id,spotlight_until,updated_at)
  values(p_user_id,v_until,now())
  on conflict (user_id) do update
  set spotlight_until=excluded.spotlight_until,
      updated_at=now();

  return jsonb_build_object('spotlight_until',v_until,'balance',greatest(0,v_earned-v_used-case when v_free then 0 else 1 end),'owner_access',v_owner,'test_access',v_test);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vybe_like_and_match(p_user_id uuid, p_target_user_id uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
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
  v_owner boolean;
  v_test boolean;
  v_free boolean;
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

  select exists(select 1 from public.admin_users where user_id=p_user_id and role='owner') into v_owner;
  v_test := public.vybe_has_test_access(p_user_id);
  v_free := v_owner or v_test;

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
      'owner_access', v_owner,
      'test_access', v_test,
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

      if not v_free and v_earned - v_used < 1 then
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

      if not v_free then
        insert into public.reward_uses(user_id,reward_type,reward_amount) values(p_user_id,'supervybe',1);
        v_super_charged := true;
        v_used := v_used + 1;
      end if;
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
    'owner_access', v_owner,
      'test_access', v_test,
    'balance', v_balance
  );
end;
$function$
;

revoke all on function public.use_spotlight(uuid),public.vybe_like_and_match(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.use_spotlight(uuid),public.vybe_like_and_match(uuid,uuid,text) to service_role;
