-- Synthetic rows always roll back; no Telegram sends or account deletion.
begin;
set local role service_role;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid();
  seed bigint:=-940000000000-floor(random()*10000000000)::bigint;
  start_at timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  input jsonb; r jsonb; bad jsonb;
begin
  if has_function_privilege('anon','public.vybe_plan_list(uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.vybe_plan_list(uuid,jsonb)','EXECUTE')
    or (select prosecdef from pg_proc where oid='public.vybe_plan_list(uuid,jsonb)'::regprocedure) then raise exception 'Unsafe client grants or function privileges'; end if;
  insert into public.users(id,telegram_id,first_name) values(a,seed,'Plan Date QA A'),(b,seed-1,'Plan Date QA B'),(c,seed-2,'Plan Date QA C');
  insert into public.profiles(user_id,name,age,city,gender,looking_for,bio,photo_url)
    select x,'Plan Date QA',28,'Київ','Чоловік','Усіх','Rollback date filter QA',x::text||'/qa.jpg' from unnest(array[a,b,c]) x;
  start_at:=start_at+interval '3 days 18 hours';
  input:=jsonb_build_object('category','party','starts_from',to_char(start_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'starts_before',to_char((start_at+interval '2 hours') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'bounds',jsonb_build_object('south',78.54,'north',78.56,'west',168.34,'east',168.36));
  insert into public.vybe_plans(id,owner_id,client_nonce,request_hash,category,title,description,city,venue_label,visibility,map_lat,map_lng,starts_at,ends_at,capacity)
    values(p1,a,gen_random_uuid(),'qa','party','First boundary QA','','Київ','Approximate area','private',78.55,168.35,start_at,start_at+interval '2 hours',4),
      (p2,a,gen_random_uuid(),'qa','party','Inside window QA','','Київ','Approximate area','private',78.55,168.35,start_at+interval '1 hour',start_at+interval '3 hours',4),
      (p3,a,gen_random_uuid(),'qa','party','Last boundary QA','','Київ','Approximate area','private',78.55,168.35,start_at+interval '2 hours',start_at+interval '4 hours',4);
  insert into public.vybe_plan_locations(plan_id,meeting_details) values(p1,'SECRET DATE QA ADDRESS'),(p2,'SECRET DATE QA ADDRESS'),(p3,'SECRET DATE QA ADDRESS');
  -- 101 earlier plans would crowd out the selected day if filtering happened after LIMIT.
  insert into public.vybe_plans(owner_id,client_nonce,request_hash,category,title,description,city,venue_label,visibility,map_lat,map_lng,starts_at,ends_at,capacity)
    select a,gen_random_uuid(),'qa','party','Earlier filter QA','','Київ','Public place','public',78.55,168.35,start_at-interval '1 day'+x*interval '1 minute',start_at-interval '1 day'+x*interval '1 minute'+interval '2 hours',4
    from generate_series(1,101) x;
  r:=public.vybe_plan_list(b,input);
  if jsonb_array_length(r->'plans')<>2 or r->'plans'->0->>'id'<>p1::text or r->'plans'->1->>'id'<>p2::text
    or r::text like '%SECRET DATE QA ADDRESS%' then raise exception 'Wrong half-open range, limit ordering or private-address exposure'; end if;
  r:=public.vybe_plan_list(b,input||jsonb_build_object('category','pizza'));if r->'plans'<>'[]'::jsonb then raise exception 'Category ignored';end if;
  r:=public.vybe_plan_list(b,input||jsonb_build_object('bounds',jsonb_build_object('south',50,'north',51,'west',30,'east',31)));if r->'plans'<>'[]'::jsonb then raise exception 'Geographic bounds ignored';end if;
  r:=public.vybe_plan_list(b,input-'starts_from'-'starts_before');if jsonb_array_length(r->'plans')<>100 then raise exception 'Unfiltered limit changed';end if;
  r:=public.vybe_plan_list(b,(input-'starts_from'-'starts_before')||jsonb_build_object('day','24h'));if r->'plans'<>'[]'::jsonb then raise exception 'Legacy 24-hour filter changed';end if;
  r:=public.vybe_plan_list(b,(input-'starts_from'-'starts_before')||jsonb_build_object('day','week'));if jsonb_array_length(r->'plans')<>100 then raise exception 'Legacy week filter changed';end if;
  for bad in select x from jsonb_array_elements(jsonb_build_array(
    input-'starts_before',input||jsonb_build_object('starts_from',null),input||jsonb_build_object('starts_before',input->>'starts_from'),
    input||jsonb_build_object('starts_from','2026-02-30T00:00:00.000Z'),input||jsonb_build_object('starts_from','2026-10-10T15:00'),
    input||jsonb_build_object('starts_before',to_char((start_at+interval '27 hours') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    input||jsonb_build_object('day','24h'),input||jsonb_build_object('bounds',jsonb_build_object('south',50,'north',49,'west',30,'east',31)))) x loop
    begin perform public.vybe_plan_list(b,bad);raise exception 'Invalid search accepted';exception when sqlstate '22023' then if sqlerrm<>'INVALID_PLAN' then raise;end if;end;
  end loop;
  -- Local full-day boundaries span 25 hours at the browser's autumn DST transition.
  perform public.vybe_plan_list(b,jsonb_build_object('starts_from','2026-10-24T21:00:00.000Z','starts_before','2026-10-25T22:00:00.000Z','bounds',input->'bounds'));
  update public.vybe_plans set status='cancelled' where id=p1;
  r:=public.vybe_plan_list(b,input);if jsonb_array_length(r->'plans')<>1 or r->'plans'->0->>'id'<>p2::text then raise exception 'Cancelled plans included';end if;
  insert into public.blocks(blocker_id,blocked_id) values(b,a);
  r:=public.vybe_plan_list(b,input);if r->'plans'<>'[]'::jsonb then raise exception 'Forward block ignored';end if;
  r:=public.vybe_plan_list(a,jsonb_build_object('bounds',input->'bounds'));if jsonb_array_length(r->'plans')<>100 then raise exception 'Host cannot browse own plans';end if;
  insert into public.blocks(blocker_id,blocked_id) values(a,c);
  r:=public.vybe_plan_list(c,input);if r->'plans'<>'[]'::jsonb then raise exception 'Reverse block ignored';end if;
  update public.users set account_status='restricted' where id=a;
  r:=public.vybe_plan_list(c,input-'starts_from'-'starts_before');if r->'plans'<>'[]'::jsonb then raise exception 'Restricted host listed';end if;
  begin perform public.vybe_plan_list(a,input);raise exception 'Restricted viewer searched';exception when insufficient_privilege then if sqlerrm<>'PLAN_UNAVAILABLE' then raise;end if;end;
  begin perform public.vybe_plan_list(null,input);raise exception 'Anonymous viewer searched';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Plan date range, timezone, before-limit filtering, legacy filters and access checks passed' as result;
rollback;
