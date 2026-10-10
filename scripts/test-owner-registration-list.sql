-- Run against the deployed RPC as the API role. Every fixture and event is rolled back.
begin;
set local role service_role;
do $$
declare
  v_owner uuid; v_admin uuid; v_ids uuid[] := '{}'::uuid[];
  v_tg bigint := 8100000000000 + floor(random()*100000000)::bigint;
  v_snapshot timestamptz := now(); v_today timestamptz;
  v_time timestamptz; v_result jsonb; v_item jsonb; v_cursor jsonb;
  v_seen uuid[] := '{}'::uuid[]; v_expected uuid[]; v_expected_total bigint;
  v_expected_today bigint; v_expected_week bigint; v_pages integer := 0; v_i integer; v_id uuid;
begin
  select user_id into strict v_owner from public.admin_users where role='owner';
  v_today := date_trunc('day', v_snapshot at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv';
  for v_i in 1..60 loop
    v_id := gen_random_uuid(); v_ids := array_append(v_ids,v_id);
    v_time := case
      when v_i in (51,52) then v_snapshot - interval '30 seconds'
      when v_i in (53,54,55) then null
      when v_i=56 then v_today - interval '1 microsecond'
      when v_i=57 then v_snapshot - interval '7 days'
      when v_i=58 then v_snapshot - interval '7 days 1 microsecond'
      when v_i=59 then v_snapshot + interval '1 second'
      when v_i=60 then v_today
      else v_snapshot - make_interval(secs=>v_i) end;
    insert into public.users(id,telegram_id,first_name,username,created_at,last_seen)
      values(v_id,v_tg+v_i,'SQL Registration QA','sql_qa',v_time,v_snapshot);
  end loop;
  v_admin := v_ids[1];
  insert into public.admin_users(user_id,role) values(v_admin,'admin');
  insert into public.profiles(user_id,name,age,bio,created_at) values(v_ids[2],'Profile QA',28,'Private bio must not be returned',v_snapshot);

  begin perform public.vybe_owner_registrations(v_admin);raise exception 'admin list exposed';exception when insufficient_privilege then null;end;
  begin perform public.vybe_owner_registrations(v_ids[3]);raise exception 'nonadmin list exposed';exception when insufficient_privilege then null;end;
  begin perform public.vybe_owner_registrations(null);raise exception 'anonymous actor';exception when insufficient_privilege then null;end;
  begin perform public.vybe_owner_registrations(v_owner,'month');raise exception 'filter accepted';exception when invalid_parameter_value then null;end;
  begin perform public.vybe_owner_registrations(v_owner,'all',v_snapshot,null);raise exception 'incomplete cursor';exception when invalid_parameter_value then null;end;
  begin perform public.vybe_owner_registrations(v_owner,'all',null,v_ids[1]);raise exception 'snapshot missing';exception when invalid_parameter_value then null;end;

  select count(*),array_agg(id order by created_at desc nulls last,id desc) into v_expected_total,v_expected
    from public.users where created_at<=v_snapshot or created_at is null;
  select count(*) into v_expected_today from public.users where created_at between v_today and v_snapshot;
  select count(*) into v_expected_week from public.users where created_at between v_snapshot-interval '7 days' and v_snapshot;
  v_result := public.vybe_owner_registrations(v_owner,'today',null,null,v_snapshot);
  if (v_result->>'total')::bigint<>v_expected_today then raise exception 'Kyiv today boundary';end if;
  if exists(select 1 from jsonb_array_elements(v_result->'users') x where (x->>'registered_at')::timestamptz<v_today or x->>'registered_at' is null) then raise exception 'today contains old/unknown';end if;
  v_result := public.vybe_owner_registrations(v_owner,'week',null,null,v_snapshot);
  if (v_result->>'total')::bigint<>v_expected_week then raise exception 'seven day boundary';end if;

  loop
    v_result := public.vybe_owner_registrations(v_owner,'all',
      (v_cursor->>'registered_at')::timestamptz,(v_cursor->>'id')::uuid,
      coalesce((v_cursor->>'snapshot_at')::timestamptz,v_snapshot),7);
    v_pages := v_pages + 1;
    if v_pages>20 then raise exception 'pagination loop';end if;
    if (v_result->>'total')::bigint<>v_expected_total then raise exception 'snapshot total drift';end if;
    if jsonb_array_length(v_result->'users')>7 then raise exception 'page limit';end if;
    for v_item in select value from jsonb_array_elements(v_result->'users') loop
      v_id := (v_item->>'id')::uuid;
      if v_id=any(v_seen) then raise exception 'duplicate registration';end if;
      v_seen := array_append(v_seen,v_id);
      if (select count(*) from jsonb_object_keys(v_item))<>7
        or not(v_item ?& array['id','display_name','username','registered_at','has_profile','profile_created_at','last_seen'])
        then raise exception 'unexpected/sensitive fields';end if;
      if v_id=v_ids[2] and ((v_item->>'has_profile')::boolean is not true or v_item->>'display_name'<>'Profile QA') then raise exception 'profile status/name';end if;
    end loop;
    -- A new registration during pagination must wait for Refresh.
    if v_pages=1 then insert into public.users(telegram_id,first_name,created_at) values(v_tg+100,'New after snapshot',v_snapshot+interval '1 microsecond');end if;
    exit when not(v_result->>'has_more')::boolean;
    v_cursor := v_result->'next_cursor';
    if (v_cursor->>'snapshot_at')::timestamptz<>v_snapshot then raise exception 'snapshot cursor';end if;
  end loop;
  if v_seen<>v_expected then raise exception 'missing registration or unstable ordering';end if;
  if v_ids[59]=any(v_seen) then raise exception 'future row included';end if;
  v_result := public.vybe_owner_registrations(v_owner,'all',null,null,v_snapshot,100000);
  if jsonb_array_length(v_result->'users')<>50 then raise exception 'maximum limit';end if;
  v_result := public.vybe_owner_registrations(v_owner,'all',null,null,v_snapshot,0);
  if jsonb_array_length(v_result->'users')<>1 then raise exception 'minimum limit';end if;
  if has_function_privilege('anon','public.vybe_owner_registrations(uuid,text,timestamptz,uuid,timestamptz,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.vybe_owner_registrations(uuid,text,timestamptz,uuid,timestamptz,integer)','EXECUTE')
    then raise exception 'client RPC exposed';end if;
end;
$$;
rollback;
select jsonb_build_object('result','owner registration authorization, dates, filters and pagination passed; fixtures rolled back',
  'users',(select count(*) from public.users),'profiles',(select count(*) from public.profiles)) as checks;
