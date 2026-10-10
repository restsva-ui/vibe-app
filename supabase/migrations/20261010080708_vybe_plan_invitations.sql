-- Invitation publication is explicit. Existing plans remain private to authorized users.
create table public.vybe_plan_invites (
  plan_id uuid primary key references public.vybe_plans(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  enabled boolean not null default false
);
create table public.vybe_plan_calendar_tokens (
  plan_id uuid not null references public.vybe_plans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  primary key(plan_id,user_id)
);
create table public.vybe_plan_reminders (
  plan_id uuid not null references public.vybe_plans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  enabled boolean not null default false,
  due_at timestamptz not null,
  notified_at timestamptz,
  push_status text not null default 'pending' check(push_status in ('pending','attempted','sent','retry','skipped','failed','unknown')),
  claim uuid,
  attempts integer not null default 0,
  retry_at timestamptz,
  primary key(plan_id,user_id)
);
create index vybe_plan_reminders_due on public.vybe_plan_reminders(due_at) where enabled and push_status in ('pending','retry');
create table public.vybe_plan_worker_auth (
  singleton boolean primary key default true check(singleton),
  secret_hash text not null
);
alter table public.vybe_plan_invites enable row level security;
alter table public.vybe_plan_calendar_tokens enable row level security;
alter table public.vybe_plan_reminders enable row level security;
alter table public.vybe_plan_worker_auth enable row level security;
revoke all on public.vybe_plan_invites,public.vybe_plan_calendar_tokens,public.vybe_plan_reminders,public.vybe_plan_worker_auth from public,anon,authenticated;
grant all on public.vybe_plan_invites,public.vybe_plan_calendar_tokens,public.vybe_plan_reminders,public.vybe_plan_worker_auth to service_role;

create function public.vybe_plan_preview_card(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',p.id,'category',p.category,'title',p.title,'city',p.city,
    'venue_label',case when p.visibility='private' then 'Приблизний район' else p.venue_label end,
    'visibility',p.visibility,'starts_at',p.starts_at,'ends_at',p.ends_at,'capacity',p.capacity,
    'approved_count',1+(select count(*) from public.vybe_plan_applications a where a.plan_id=p.id and a.status='approved'))
  from public.vybe_plans p where p.id=p_id;
$$;
create function public.vybe_plan_invite_preview(p_token uuid,p_viewer uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$
  select public.vybe_plan_preview_card(p.id) from public.vybe_plan_invites i
  join public.vybe_plans p on p.id=i.plan_id join public.users u on u.id=p.owner_id
  where i.token=p_token and i.enabled and p.status='active' and p.starts_at>now() and u.account_status='active'
    and (p_viewer is null or public.vybe_plan_visible(p_viewer,p.owner_id));
$$;
create function public.vybe_plan_calendar_export(p_token uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select public.vybe_plan_preview_card(p.id) from public.vybe_plan_calendar_tokens c
  join public.vybe_plans p on p.id=c.plan_id
  where c.token=p_token and p.status='active' and p.ends_at>now() and public.vybe_plan_visible(c.user_id,p.owner_id)
    and (c.user_id=p.owner_id or exists(select 1 from public.vybe_plan_applications a where a.plan_id=p.id and a.user_id=c.user_id and a.status='approved'));
$$;
create function public.vybe_plan_growth(p_user uuid,p_action text,p_plan uuid,p_enabled boolean default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.vybe_plans%rowtype; i public.vybe_plan_invites%rowtype; r public.vybe_plan_reminders%rowtype; v_token uuid; v_member boolean;
begin
  select * into p from public.vybe_plans where id=p_plan for update;
  if not found or not public.vybe_plan_visible(p_user,p.owner_id) then raise exception 'PLAN_UNAVAILABLE' using errcode='42501';end if;
  if p.status<>'active' or p.ends_at<=now() then raise exception 'PLAN_CLOSED' using errcode='55000';end if;
  v_member:=p_user=p.owner_id or exists(select 1 from public.vybe_plan_applications a where a.plan_id=p.id and a.user_id=p_user and a.status='approved');
  if p_action in ('invite_get','invite_update') then
    if p_user<>p.owner_id then raise exception 'PLAN_UNAVAILABLE' using errcode='42501';end if;
    if p.starts_at<=now() then raise exception 'PLAN_CLOSED' using errcode='55000';end if;
    if p_action='invite_update' then
      if p_enabled is null then raise exception 'INVALID_PLAN' using errcode='22023';end if;
      insert into public.vybe_plan_invites(plan_id,enabled) values(p.id,p_enabled)
        on conflict(plan_id) do update set enabled=excluded.enabled,token=case when public.vybe_plan_invites.enabled and not excluded.enabled then gen_random_uuid() else public.vybe_plan_invites.token end;
    end if;
    select * into i from public.vybe_plan_invites where plan_id=p.id;
    return jsonb_build_object('enabled',coalesce(i.enabled,false),'plan',public.vybe_plan_preview_card(p.id));
  end if;
  if not v_member then raise exception 'PLAN_JOIN_REQUIRED' using errcode='42501';end if;
  if p_action='share' then
    if p.starts_at<=now() then raise exception 'PLAN_CLOSED' using errcode='55000';end if;
    select * into i from public.vybe_plan_invites where plan_id=p.id and enabled;
    if not found then raise exception 'PLAN_INVITE_UNAVAILABLE' using errcode='42501';end if;
    return jsonb_build_object('token',i.token,'plan',public.vybe_plan_preview_card(p.id));
  elsif p_action='calendar' then
    insert into public.vybe_plan_calendar_tokens(plan_id,user_id) values(p.id,p_user) on conflict do nothing;
    select token into v_token from public.vybe_plan_calendar_tokens where plan_id=p.id and user_id=p_user;
    return jsonb_build_object('token',v_token);
  elsif p_action in ('reminder_get','reminder_set') then
    if p_action='reminder_set' then
      if p_enabled is null then raise exception 'INVALID_PLAN' using errcode='22023';end if;
      if p_enabled and p.starts_at<=now() then raise exception 'PLAN_CLOSED' using errcode='55000';end if;
      insert into public.vybe_plan_reminders(plan_id,user_id,enabled,due_at) values(p.id,p_user,p_enabled,greatest(now(),p.starts_at-interval '1 hour'))
        on conflict(plan_id,user_id) do update set enabled=excluded.enabled;
    end if;
    select * into r from public.vybe_plan_reminders where plan_id=p.id and user_id=p_user;
    return jsonb_build_object('enabled',coalesce(r.enabled,false),'delivered',r.notified_at is not null);
  end if;
  raise exception 'INVALID_PLAN' using errcode='22023';
end;
$$;

create function public.vybe_plan_worker_authorized(p_secret text) returns boolean
language sql stable security invoker set search_path='' as $$
  select length(p_secret)=64 and exists(select 1 from public.vybe_plan_worker_auth where secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex'));
$$;
create function public.vybe_plan_reminder_allowed(p_plan uuid,p_user uuid,p_claim uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.vybe_plan_reminders r join public.vybe_plans p on p.id=r.plan_id
    join public.notification_preferences n on n.user_id=r.user_id
    where r.plan_id=p_plan and r.user_id=p_user and r.claim=p_claim and r.enabled and n.messages_enabled
      and p.status='active' and p.starts_at>now() and public.vybe_plan_visible(r.user_id,p.owner_id)
      and (r.user_id=p.owner_id or exists(select 1 from public.vybe_plan_applications a where a.plan_id=p.id and a.user_id=r.user_id and a.status='approved')));
$$;
create function public.vybe_plan_reminder_claim() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r record; v_claim uuid; v_rows jsonb:='[]'::jsonb;
begin
  for r in select m.plan_id,m.user_id,u.telegram_id from public.vybe_plan_reminders m
    join public.vybe_plans p on p.id=m.plan_id join public.users u on u.id=m.user_id
    where m.enabled and m.due_at<=now() and m.push_status in ('pending','retry') and m.attempts<3
      and (m.retry_at is null or m.retry_at<=now()) and p.status='active' and p.starts_at>now()
      and public.vybe_plan_visible(m.user_id,p.owner_id)
      and (m.user_id=p.owner_id or exists(select 1 from public.vybe_plan_applications a where a.plan_id=p.id and a.user_id=m.user_id and a.status='approved'))
    order by m.due_at limit 50 for update of m skip locked
  loop
    v_claim:=gen_random_uuid();
    insert into public.notification_events(recipient_user_id,event_type,source_key,payload)
      values(r.user_id,'system','plan:reminder:'||r.plan_id||':'||r.user_id,jsonb_build_object('kind','plan_reminder','plan_id',r.plan_id)) on conflict(source_key) do nothing;
    update public.vybe_plan_reminders set notified_at=coalesce(notified_at,now()),push_status='attempted',claim=v_claim,attempts=attempts+1 where plan_id=r.plan_id and user_id=r.user_id;
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object('plan_id',r.plan_id,'user_id',r.user_id,'telegram_id',r.telegram_id,'claim',v_claim));
  end loop;
  return v_rows;
end;
$$;
create function public.vybe_plan_reminder_finish(p_plan uuid,p_user uuid,p_claim uuid,p_outcome text,p_retry integer default 0) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_outcome not in ('sent','retry','skipped','failed','unknown') then raise exception 'INVALID_PLAN' using errcode='22023';end if;
  update public.vybe_plan_reminders set push_status=p_outcome,retry_at=case when p_outcome='retry' then now()+greatest(60,least(3600,p_retry))*interval '1 second' else null end
    where plan_id=p_plan and user_id=p_user and claim=p_claim and push_status='attempted';
end;
$$;
revoke all on function public.vybe_plan_preview_card(uuid),public.vybe_plan_invite_preview(uuid,uuid),public.vybe_plan_calendar_export(uuid),public.vybe_plan_growth(uuid,text,uuid,boolean),public.vybe_plan_worker_authorized(text),public.vybe_plan_reminder_allowed(uuid,uuid,uuid),public.vybe_plan_reminder_claim(),public.vybe_plan_reminder_finish(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.vybe_plan_preview_card(uuid),public.vybe_plan_invite_preview(uuid,uuid),public.vybe_plan_calendar_export(uuid),public.vybe_plan_growth(uuid,text,uuid,boolean),public.vybe_plan_worker_authorized(text),public.vybe_plan_reminder_allowed(uuid,uuid,uuid),public.vybe_plan_reminder_claim(),public.vybe_plan_reminder_finish(uuid,uuid,uuid,text,integer) to service_role;
