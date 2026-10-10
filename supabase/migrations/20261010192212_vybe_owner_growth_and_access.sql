-- Owner-only registration notifications and aggregate admin counters.
-- New registrations and first profiles share the existing minute reminder worker.
-- No backfill of existing users, no analytics events, and no private profile content.
create table private.vybe_growth_settings (
  singleton boolean primary key default true check (singleton),
  owner_user_id uuid not null unique references public.users(id) on delete cascade,
  enabled boolean not null default true
);
create table private.vybe_growth_events (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  kind text not null check (kind in ('user_registered','profile_created','system_ready')),
  subject_user_id uuid references public.users(id) on delete cascade,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  state text not null default 'pending' check (state in ('pending','attempted','sent','retry','skipped','failed','unknown')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  claim uuid,
  claimed_at timestamptz,
  retry_at timestamptz,
  sent_at timestamptz
);
alter table private.vybe_growth_settings enable row level security;
alter table private.vybe_growth_events enable row level security;
revoke all on private.vybe_growth_settings,private.vybe_growth_events from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.vybe_growth_settings,private.vybe_growth_events to service_role;
create index vybe_growth_subject_idx on private.vybe_growth_events(subject_user_id);
create index vybe_growth_recipient_idx on private.vybe_growth_events(recipient_user_id);
create index vybe_growth_pending_idx on private.vybe_growth_events(occurred_at,retry_at)
  where state in ('pending','retry') and attempts<3;

-- The existing, verified owner receives these alerts; other admins do not.
insert into private.vybe_growth_settings(singleton,owner_user_id)
select true,a.user_id from public.admin_users a join public.users u on u.id=a.user_id
where a.role='owner' and lower(u.username)='chefsva';

create function private.vybe_queue_growth() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_subject uuid;v_kind text;v_owner uuid;
begin
  select s.owner_user_id into v_owner from private.vybe_growth_settings s
    join public.admin_users a on a.user_id=s.owner_user_id and a.role='owner'
    join public.users u on u.id=s.owner_user_id and u.account_status='active'
    where s.singleton and s.enabled;
  if v_owner is null then return new;end if;
  if tg_table_name='users' then v_subject:=new.id;v_kind:='user_registered';
  elsif tg_table_name='profiles' then v_subject:=new.user_id;v_kind:='profile_created';
  else raise exception 'INVALID_GROWTH_TRIGGER';end if;
  insert into private.vybe_growth_events(source_key,kind,subject_user_id,recipient_user_id,occurred_at)
    values(v_kind||':'||v_subject,v_kind,v_subject,v_owner,coalesce(new.created_at,now()))
    on conflict(source_key) do nothing;
  return new;
end;
$$;
revoke all on function private.vybe_queue_growth() from public,anon,authenticated;
grant execute on function private.vybe_queue_growth() to service_role;
create trigger vybe_growth_user_registered after insert on public.users
  for each row execute function private.vybe_queue_growth();
create trigger vybe_growth_profile_created after insert on public.profiles
  for each row execute function private.vybe_queue_growth();

create function public.vybe_admin_growth_summary(p_actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_today timestamptz;v_result jsonb;
begin
  if not exists(select 1 from public.admin_users where user_id=p_actor and role in ('owner','admin')) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  v_today:=((now() at time zone 'Europe/Kyiv')::date)::timestamp at time zone 'Europe/Kyiv';
  select jsonb_build_object(
    'users_total',(select count(*) from public.users),
    'profiles_total',(select count(*) from public.profiles),
    'new_users_today',(select count(*) from public.users where created_at>=v_today),
    'new_profiles_today',(select count(*) from public.profiles where created_at>=v_today),
    'new_users_7d',(select count(*) from public.users where created_at>=now()-interval '7 days'),
    'active_users_7d',(select count(*) from public.users where last_seen>=now()-interval '7 days'),
    'last_registration_at',(select max(created_at) from public.users),
    'snapshot_at',now(),'time_zone','Europe/Kyiv',
    'notifications_enabled',exists(select 1 from private.vybe_growth_settings s
      join public.admin_users a on a.user_id=s.owner_user_id and a.role='owner'
      where s.enabled and s.owner_user_id=p_actor),
    'alerts_pending',(select count(*) from private.vybe_growth_events where state in ('pending','retry','attempted')),
    'alerts_failed',(select count(*) from private.vybe_growth_events where state in ('failed','unknown'))
  ) into v_result;
  return v_result;
end;
$$;

-- One Telegram digest per minute avoids a burst of messages to a single owner.
create function public.vybe_growth_claim() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid;v_telegram bigint;v_claim uuid:=gen_random_uuid();r record;v_events jsonb:='[]'::jsonb;
begin
  select s.owner_user_id,u.telegram_id into v_owner,v_telegram from private.vybe_growth_settings s
    join public.admin_users a on a.user_id=s.owner_user_id and a.role='owner'
    join public.users u on u.id=s.owner_user_id and u.account_status='active'
    where s.singleton and s.enabled;
  if v_owner is null then return null;end if;
  for r in select g.id,g.kind,g.occurred_at from private.vybe_growth_events g
    where g.recipient_user_id=v_owner and g.state in ('pending','retry') and g.attempts<3
      and (g.retry_at is null or g.retry_at<=now())
    order by g.occurred_at,g.id limit 100 for update of g skip locked
  loop
    update private.vybe_growth_events set state='attempted',attempts=attempts+1,claim=v_claim,claimed_at=now()
      where id=r.id;
    v_events:=v_events||jsonb_build_array(jsonb_build_object('id',r.id,'kind',r.kind,'occurred_at',r.occurred_at));
  end loop;
  if jsonb_array_length(v_events)=0 then return null;end if;
  return jsonb_build_object('claim',v_claim,'telegram_id',v_telegram,'events',v_events);
end;
$$;

-- Recheck ownership immediately before delivery and return only aggregate data.
create function public.vybe_growth_payload(p_claim uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object('claim',p_claim,'telegram_id',u.telegram_id,
  'events',jsonb_agg(jsonb_build_object('id',g.id,'kind',g.kind,'occurred_at',g.occurred_at) order by g.occurred_at,g.id),
  'users_total',(select count(*) from public.users),'profiles_total',(select count(*) from public.profiles))
from private.vybe_growth_events g
join private.vybe_growth_settings s on s.owner_user_id=g.recipient_user_id and s.enabled
join public.admin_users a on a.user_id=s.owner_user_id and a.role='owner'
join public.users u on u.id=s.owner_user_id and u.account_status='active'
where g.claim=p_claim and g.state='attempted'
group by u.telegram_id having count(*)>0;
$$;

create function public.vybe_growth_finish(p_claim uuid,p_outcome text,p_retry integer default 0) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_outcome not in ('sent','retry','skipped','failed','unknown') then
    raise exception 'INVALID_GROWTH_OUTCOME' using errcode='22023';
  end if;
  update private.vybe_growth_events set state=p_outcome,
    sent_at=case when p_outcome='sent' then now() else null end,
    retry_at=case when p_outcome='retry' and attempts<3 then now()+greatest(60,least(3600,coalesce(p_retry,60)))*interval '1 second' else null end
    where claim=p_claim and state='attempted';
  -- A rate-limited final attempt is terminal rather than an unprocessable pending alert.
  update private.vybe_growth_events set state='failed' where claim=p_claim and state='retry' and attempts>=3;
end;
$$;
revoke all on function public.vybe_admin_growth_summary(uuid),public.vybe_growth_claim(),
  public.vybe_growth_payload(uuid),public.vybe_growth_finish(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.vybe_admin_growth_summary(uuid),public.vybe_growth_claim(),
  public.vybe_growth_payload(uuid),public.vybe_growth_finish(uuid,text,integer) to service_role;

-- A setup message proves owner delivery without inventing a new registration.
insert into private.vybe_growth_events(source_key,kind,recipient_user_id)
select 'system_ready:owner_growth_v1','system_ready',owner_user_id from private.vybe_growth_settings;

-- Same worker credential and same cron job. HTTP is invoked only for eligible work.
select cron.schedule('vybe-plan-reminders','* * * * *',$job$
  select net.http_post(
    url:='https://qifxxzpnuxchnkowxzgp.supabase.co/functions/v1/plan-invite',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='vybe_plan_reminder_worker' limit 1)),
    body:='{}'::jsonb,timeout_milliseconds:=50000)
  where exists(select 1 from public.vybe_plan_reminders r join public.vybe_plans p on p.id=r.plan_id
    where r.enabled and r.due_at<=now() and r.push_status in ('pending','retry') and r.attempts<3
      and (r.retry_at is null or r.retry_at<=now()) and p.status='active' and p.starts_at>now()
      and public.vybe_plan_visible(r.user_id,p.owner_id)
      and (r.user_id=p.owner_id or exists(select 1 from public.vybe_plan_applications a where a.plan_id=p.id and a.user_id=r.user_id and a.status='approved')))
  or exists(select 1 from private.vybe_growth_events g
    join private.vybe_growth_settings s on s.owner_user_id=g.recipient_user_id and s.enabled
    join public.admin_users a on a.user_id=s.owner_user_id and a.role='owner'
    join public.users u on u.id=s.owner_user_id and u.account_status='active'
    where g.state in ('pending','retry') and g.attempts<3 and (g.retry_at is null or g.retry_at<=now()));
$job$);

-- Full access is a server-side owner privilege, not a fabricated purchase or balance.
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
  if not v_owner and v_earned-v_used < 1 then raise exception 'NO_SPOTLIGHT'; end if;

  select spotlight_until into v_current
  from public.user_entitlements
  where user_id=p_user_id
  limit 1;

  v_until := greatest(now(),coalesce(v_current,now())) + interval '30 minutes';

  if not v_owner then
    insert into public.reward_uses(user_id,reward_type,reward_amount) values(p_user_id,'spotlight',1);
  end if;

  insert into public.user_entitlements(user_id,spotlight_until,updated_at)
  values(p_user_id,v_until,now())
  on conflict (user_id) do update
  set spotlight_until=excluded.spotlight_until,
      updated_at=now();

  return jsonb_build_object('spotlight_until',v_until,'balance',greatest(0,v_earned-v_used-case when v_owner then 0 else 1 end),'owner_access',v_owner);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.vybe_like_and_match(p_user_id uuid, p_target_user_id uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
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

      if not v_owner and v_earned - v_used < 1 then
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

      if not v_owner then
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
    'balance', v_balance
  );
end;
$function$
;

revoke all on function public.use_spotlight(uuid),public.vybe_like_and_match(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.use_spotlight(uuid),public.vybe_like_and_match(uuid,uuid,text) to service_role;
