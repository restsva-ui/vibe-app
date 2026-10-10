create function public.vybe_plan(p_user uuid,p_action text,p_input jsonb default '{}'::jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_plan public.vybe_plans%rowtype; v_id uuid; v_nonce uuid; v_target uuid;
  v_status text; v_note text; v_notice jsonb; v_notices jsonb:='[]'::jsonb; v_card jsonb;
  v_rows jsonb; v_members jsonb:='[]'::jsonb; v_requests jsonb:='[]'::jsonb; v_messages jsonb:='[]'::jsonb;
  v_start timestamptz; v_hours integer; v_capacity integer; v_lat numeric; v_lng numeric;
  v_hash text; v_recipient uuid; v_message public.vybe_plan_messages%rowtype;
  v_member boolean; v_open boolean; v_count integer; v_bounds jsonb; v_category text; v_day text;
begin
  if p_user is null or not exists(select 1 from public.users u where u.id=p_user and u.account_status='active') then
    raise exception 'PLAN_UNAVAILABLE' using errcode='42501';
  end if;
  if jsonb_typeof(p_input)<>'object' then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
  if p_action in ('list','my') then
    v_category:=coalesce(p_input->>'category',''); v_day:=coalesce(p_input->>'day','all'); v_bounds:=p_input->'bounds';
    if v_category<>'' and v_category not in ('pizza','pub','walk','celebration','party','outdoors','other') or v_day not in ('all','24h','week') then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
    if v_bounds is not null and (jsonb_typeof(v_bounds)<>'object' or jsonb_typeof(v_bounds->'south') is distinct from 'number' or jsonb_typeof(v_bounds->'north') is distinct from 'number' or jsonb_typeof(v_bounds->'west') is distinct from 'number' or jsonb_typeof(v_bounds->'east') is distinct from 'number') then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
    select coalesce(jsonb_agg(q.card order by q.starts_at),'[]'::jsonb) into v_rows from (
      select public.vybe_plan_card(p.id,p_user) card,p.starts_at from public.vybe_plans p
      where public.vybe_plan_visible(p_user,p.owner_id) and (
        (p_action='my' and (p.owner_id=p_user or exists(select 1 from public.vybe_plan_applications a where a.plan_id=p.id and a.user_id=p_user)) and p.ends_at>now()-interval '30 days')
        or (p_action='list' and p.status='active' and p.ends_at>now() and (v_category='' or p.category=v_category)
          and (v_day='all' or p.starts_at<=now()+case when v_day='24h' then interval '24 hours' else interval '7 days' end)
          and (v_bounds is null or (p.map_lat between (v_bounds->>'south')::numeric and (v_bounds->>'north')::numeric
            and (case when (v_bounds->>'west')::numeric<=(v_bounds->>'east')::numeric then p.map_lng between (v_bounds->>'west')::numeric and (v_bounds->>'east')::numeric else p.map_lng>=(v_bounds->>'west')::numeric or p.map_lng<=(v_bounds->>'east')::numeric end)))))
      order by p.starts_at limit 100
    ) q;
    return jsonb_build_object('ok',true,'plans',v_rows,'limit',100);
  end if;
  if p_action='create' then
    if not exists(select 1 from public.profiles p where p.user_id=p_user and p.age>=18 and length(btrim(p.name))>0 and length(btrim(p.bio))>0 and p.photo_url is not null) then raise exception 'PLAN_PROFILE_REQUIRED' using errcode='42501'; end if;
    begin
      v_nonce:=(p_input->>'client_nonce')::uuid; v_start:=(p_input->>'starts_at')::timestamptz;
      v_hours:=(p_input->>'duration_hours')::integer; v_capacity:=(p_input->>'capacity')::integer;
      v_lat:=(p_input->>'map_lat')::numeric; v_lng:=(p_input->>'map_lng')::numeric;
    exception when others then raise exception 'INVALID_PLAN' using errcode='22023'; end;
    if v_nonce is null or v_start is null or v_hours is null or v_capacity is null or v_lat is null or v_lng is null
      or jsonb_typeof(p_input->'duration_hours')<>'number' or jsonb_typeof(p_input->'capacity')<>'number'
      or jsonb_typeof(p_input->'map_lat')<>'number' or jsonb_typeof(p_input->'map_lng')<>'number'
      or v_hours not between 1 and 24 or v_capacity not between 2 and 20 or v_lat not between -85 and 85 or v_lng not between -180 and 180
      or coalesce(p_input->>'category','') not in ('pizza','pub','walk','celebration','party','outdoors','other')
      or coalesce(p_input->>'visibility','') not in ('public','private')
      or length(btrim(coalesce(p_input->>'title',''))) not between 3 and 80
      or length(coalesce(p_input->>'description',''))>500
      or length(btrim(coalesce(p_input->>'city',''))) not between 1 and 64
      or length(btrim(coalesce(p_input->>'venue_label',''))) not between 2 and 80
      or length(btrim(coalesce(p_input->>'meeting_details',''))) not between 2 and 300 then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
    -- Lock the actor before checking the limit and the nonce: simultaneous retries create once.
    perform 1 from public.users where id=p_user for update;
    v_hash:=md5(p_input::text);
    select * into v_plan from public.vybe_plans where owner_id=p_user and client_nonce=v_nonce;
    if found then
      if v_plan.request_hash<>v_hash then raise exception 'PLAN_RETRY_CHANGED' using errcode='55000'; end if;
      return jsonb_build_object('ok',true,'plan',public.vybe_plan_card(v_plan.id,p_user),'created',false);
    end if;
    if v_start<=now() or v_start>now()+interval '90 days' then raise exception 'INVALID_PLAN_TIME' using errcode='22023'; end if;
    if (select count(*) from public.vybe_plans where owner_id=p_user and status='active' and ends_at>now())>=5 then raise exception 'PLAN_LIMIT' using errcode='55000'; end if;
    v_lat:=case when p_input->>'visibility'='private' then round(v_lat*20)/20 else round(v_lat,3) end;
    v_lng:=case when p_input->>'visibility'='private' then round(v_lng*20)/20 else round(v_lng,3) end;
    insert into public.vybe_plans(owner_id,client_nonce,request_hash,category,title,description,city,venue_label,visibility,map_lat,map_lng,starts_at,ends_at,capacity)
      values(p_user,v_nonce,v_hash,p_input->>'category',btrim(p_input->>'title'),coalesce(p_input->>'description',''),btrim(p_input->>'city'),btrim(p_input->>'venue_label'),p_input->>'visibility',v_lat,v_lng,v_start,v_start+v_hours*interval '1 hour',v_capacity)
      returning * into v_plan;
    insert into public.vybe_plan_locations(plan_id,meeting_details) values(v_plan.id,btrim(p_input->>'meeting_details'));
    return jsonb_build_object('ok',true,'plan',public.vybe_plan_card(v_plan.id,p_user),'created',true);
  end if;
  begin v_id:=(p_input->>'plan_id')::uuid; exception when others then raise exception 'INVALID_PLAN' using errcode='22023'; end;
  -- All membership transitions and messages lock the same plan row.
  select * into v_plan from public.vybe_plans where id=v_id for update;
  if not found or not public.vybe_plan_visible(p_user,v_plan.owner_id) then raise exception 'PLAN_UNAVAILABLE' using errcode='42501'; end if;
  select status into v_status from public.vybe_plan_applications where plan_id=v_id and user_id=p_user;
  v_member:=p_user=v_plan.owner_id or coalesce(v_status='approved',false);
  v_open:=v_plan.status='active' and v_plan.ends_at>now();
  if p_action='get' then
    v_card:=public.vybe_plan_card(v_id,p_user);
    if v_member and v_open then v_card:=v_card||jsonb_build_object('meeting_details',(select meeting_details from public.vybe_plan_locations where plan_id=v_id)); end if;
    if v_member then
      select coalesce(jsonb_agg(q.profile),'[]'::jsonb) into v_members from (
        select public.vybe_plan_profile(v_plan.owner_id) profile
        union all select public.vybe_plan_profile(a.user_id) from public.vybe_plan_applications a where a.plan_id=v_id and a.status='approved' and public.vybe_plan_visible(p_user,a.user_id)
      ) q;
      select coalesce(jsonb_agg(q.message order by q.created_at,q.id),'[]'::jsonb) into v_messages from (
        select jsonb_build_object('id',m.id,'sender_id',m.sender_id,'body',m.body,'created_at',m.created_at,'sender',public.vybe_plan_profile(m.sender_id)) message,m.created_at,m.id
        from public.vybe_plan_messages m where m.plan_id=v_id and public.vybe_plan_visible(p_user,m.sender_id)
        order by m.created_at desc,m.id desc limit 100
      ) q;
    end if;
    if p_user=v_plan.owner_id then
      select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'status',a.status,'note',a.note,'profile',public.vybe_plan_profile(a.user_id)) order by a.created_at),'[]'::jsonb)
        into v_requests from public.vybe_plan_applications a where a.plan_id=v_id and a.status in ('pending','approved') and public.vybe_plan_visible(p_user,a.user_id);
    end if;
    update public.notification_events set seen_at=now() where recipient_user_id=p_user and payload->>'plan_id'=v_id::text and seen_at is null;
    return jsonb_build_object('ok',true,'plan',v_card,'members',v_members,'requests',v_requests,'messages',v_messages,'can_chat',v_member and v_open,'my_note',coalesce((select note from public.vybe_plan_applications where plan_id=v_id and user_id=p_user),''));
  end if;
  if not v_open then raise exception 'PLAN_CLOSED' using errcode='55000'; end if;
  if p_action='apply' then
    if p_user=v_plan.owner_id then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
    if not exists(select 1 from public.profiles where user_id=p_user and age>=18 and photo_url is not null and length(btrim(bio))>0) then raise exception 'PLAN_PROFILE_REQUIRED' using errcode='42501'; end if;
    v_note:=btrim(coalesce(p_input->>'note',''));
    if length(v_note)>200 then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
    if v_status='rejected' then raise exception 'PLAN_REQUEST_DECLINED' using errcode='55000'; end if;
    if v_status is null or v_status='left' then
      if 1+(select count(*) from public.vybe_plan_applications where plan_id=v_id and status='approved')>=v_plan.capacity then raise exception 'PLAN_FULL' using errcode='55000'; end if;
      insert into public.vybe_plan_applications(plan_id,user_id,status,note) values(v_id,p_user,'pending',v_note)
        on conflict(plan_id,user_id) do update set status='pending',note=excluded.note,updated_at=now();
      v_notice:=public.vybe_plan_notify(v_plan.owner_id,p_user,v_id,'plan_request','plan:request:'||v_id||':'||p_user||':'||gen_random_uuid());
      if v_notice is not null then v_notices:=v_notices||jsonb_build_array(v_notice); end if;
    end if;
  elsif p_action='respond' then
    if p_user<>v_plan.owner_id then raise exception 'PLAN_UNAVAILABLE' using errcode='42501'; end if;
    begin v_target:=(p_input->>'user_id')::uuid; exception when others then raise exception 'INVALID_PLAN' using errcode='22023'; end;
    if v_target is null or v_target=p_user or not public.vybe_plan_visible(p_user,v_target) then raise exception 'PLAN_UNAVAILABLE' using errcode='42501'; end if;
    select status into v_status from public.vybe_plan_applications where plan_id=v_id and user_id=v_target;
    if p_input->>'decision' not in ('approved','rejected') or p_input->>'decision' is null then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
    if v_status is null or v_status='left' then raise exception 'PLAN_REQUEST_MISSING' using errcode='55000'; end if;
    if v_status<>p_input->>'decision' then
      if p_input->>'decision'='approved' and 1+(select count(*) from public.vybe_plan_applications where plan_id=v_id and status='approved')>=v_plan.capacity then raise exception 'PLAN_FULL' using errcode='55000'; end if;
      update public.vybe_plan_applications set status=p_input->>'decision',updated_at=now() where plan_id=v_id and user_id=v_target;
      v_notice:=public.vybe_plan_notify(v_target,p_user,v_id,case when p_input->>'decision'='approved' then 'plan_approved' else 'plan_rejected' end,'plan:response:'||v_id||':'||v_target||':'||gen_random_uuid());
      if v_notice is not null then v_notices:=v_notices||jsonb_build_array(v_notice); end if;
    end if;
  elsif p_action='leave' then
    if p_user=v_plan.owner_id then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
    update public.vybe_plan_applications set status='left',updated_at=now() where plan_id=v_id and user_id=p_user and status in ('pending','approved');
  elsif p_action='cancel' then
    if p_user<>v_plan.owner_id then raise exception 'PLAN_UNAVAILABLE' using errcode='42501'; end if;
    update public.vybe_plans set status='cancelled' where id=v_id;
    update public.vybe_plan_locations set meeting_details='[cancelled]' where plan_id=v_id;
    for v_recipient in select user_id from public.vybe_plan_applications where plan_id=v_id and status in ('pending','approved') loop
      v_notice:=public.vybe_plan_notify(v_recipient,p_user,v_id,'plan_cancelled','plan:cancel:'||v_id||':'||v_recipient);
      if v_notice is not null then v_notices:=v_notices||jsonb_build_array(v_notice); end if;
    end loop;
  elsif p_action='message' then
    if not v_member then raise exception 'PLAN_JOIN_REQUIRED' using errcode='42501'; end if;
    begin v_nonce:=(p_input->>'client_nonce')::uuid; exception when others then raise exception 'INVALID_PLAN' using errcode='22023'; end;
    v_note:=btrim(coalesce(p_input->>'body',''));
    if v_nonce is null or length(v_note) not between 1 and 1000 then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
    select * into v_message from public.vybe_plan_messages where plan_id=v_id and sender_id=p_user and client_nonce=v_nonce;
    if found then
      if v_message.body<>v_note then raise exception 'PLAN_RETRY_CHANGED' using errcode='55000'; end if;
    else
      insert into public.vybe_plan_messages(plan_id,sender_id,client_nonce,body) values(v_id,p_user,v_nonce,v_note) returning * into v_message;
      for v_recipient in select v_plan.owner_id union select user_id from public.vybe_plan_applications where plan_id=v_id and status='approved' loop
        v_notice:=public.vybe_plan_notify(v_recipient,p_user,v_id,'plan_message','plan:message:'||v_message.id||':'||v_recipient);
        if v_notice is not null then v_notices:=v_notices||jsonb_build_array(v_notice); end if;
      end loop;
    end if;
  else raise exception 'INVALID_PLAN' using errcode='22023'; end if;
  return jsonb_build_object('ok',true,'plan',public.vybe_plan_card(v_id,p_user),'notices',v_notices);
end;
$$;

revoke all on function public.vybe_plan(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.vybe_plan(uuid,text,jsonb) to service_role;
