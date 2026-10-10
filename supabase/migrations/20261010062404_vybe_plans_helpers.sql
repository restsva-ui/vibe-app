create function public.vybe_plan_visible(p_viewer uuid,p_other uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.users a,public.users b
    where a.id=p_viewer and b.id=p_other and a.account_status='active' and b.account_status='active')
    and not exists(select 1 from public.blocks x where (x.blocker_id=p_viewer and x.blocked_id=p_other) or (x.blocker_id=p_other and x.blocked_id=p_viewer));
$$;
create function public.vybe_plan_profile(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('user_id',p.user_id,'name',p.name,'age',p.age,'photo_url',p.photo_url,'verified',p.verified)
  from public.profiles p where p.user_id=p_user;
$$;
create function public.vybe_plan_card(p_id uuid,p_viewer uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',p.id,'owner_id',p.owner_id,'host',public.vybe_plan_profile(p.owner_id),
    'category',p.category,'title',p.title,'description',p.description,'city',p.city,'venue_label',p.venue_label,
    'visibility',p.visibility,'map_lat',p.map_lat,'map_lng',p.map_lng,'starts_at',p.starts_at,'ends_at',p.ends_at,
    'capacity',p.capacity,'approved_count',1+(select count(*) from public.vybe_plan_applications a where a.plan_id=p.id and a.status='approved'),
    'status',case when p.status='cancelled' then 'cancelled' when p.ends_at<=now() then 'ended' else 'active' end,
    'my_status',case when p.owner_id=p_viewer then 'host' else coalesce((select a.status from public.vybe_plan_applications a where a.plan_id=p.id and a.user_id=p_viewer),'none') end,
    'pending_count',case when p.owner_id=p_viewer then (select count(*) from public.vybe_plan_applications a where a.plan_id=p.id and a.status='pending' and public.vybe_plan_visible(p_viewer,a.user_id)) else 0 end)
  from public.vybe_plans p where p.id=p_id and public.vybe_plan_visible(p_viewer,p.owner_id);
$$;
create function public.vybe_plan_notify(p_recipient uuid,p_actor uuid,p_plan uuid,p_kind text,p_key text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  if p_recipient=p_actor or not public.vybe_plan_visible(p_recipient,p_actor) then return null; end if;
  insert into public.notification_events(recipient_user_id,event_type,source_key,payload)
    values(p_recipient,'system',p_key,jsonb_build_object('kind',p_kind,'plan_id',p_plan))
    on conflict(source_key) do nothing returning id into v_id;
  if v_id is null then return null; end if;
  return jsonb_build_object('recipient_id',p_recipient,'source_key',p_key,'kind',p_kind,'plan_id',p_plan);
end;
$$;
-- Throttle plan pushes across all plans; retries share the existing delivery claim ledger.
create function public.vybe_claim_plan_notice(p_recipient uuid,p_actor uuid,p_source_key text) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if not public.vybe_plan_visible(p_recipient,p_actor) or not exists(select 1 from public.notification_events n where n.recipient_user_id=p_recipient and n.source_key=p_source_key and n.payload->>'kind' like 'plan_%') then
    return jsonb_build_object('claimed',false);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_recipient::text||':plan_notice',0));
  if exists(select 1 from public.notification_deliveries d where d.recipient_user_id=p_recipient and d.source_key like 'plan:%' and d.created_at>=now()-interval '3 minutes') then
    return jsonb_build_object('claimed',false);
  end if;
  return public.vybe_claim_notification_delivery(p_recipient,p_actor,'message',null,p_source_key,0);
end;
$$;

revoke all on function public.vybe_plan_visible(uuid,uuid),public.vybe_plan_profile(uuid),public.vybe_plan_card(uuid,uuid),public.vybe_plan_notify(uuid,uuid,uuid,text,text),public.vybe_claim_plan_notice(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.vybe_plan_visible(uuid,uuid),public.vybe_plan_profile(uuid),public.vybe_plan_card(uuid,uuid),public.vybe_plan_notify(uuid,uuid,uuid,text,text),public.vybe_claim_plan_notice(uuid,uuid,text) to service_role;
