-- All users, plans, messages and notifications are synthetic and rolled back.
begin;
set local role service_role;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid();
  plan uuid; message_nonce uuid:=gen_random_uuid(); input jsonb; r jsonb; seed bigint:=-910000000000-floor(random()*10000000000)::bigint;
begin
  if has_function_privilege('anon','public.vybe_plan(uuid,text,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.vybe_plan_card(uuid,uuid)','EXECUTE')
    or has_table_privilege('anon','public.vybe_plan_locations','SELECT') or has_table_privilege('authenticated','public.vybe_plan_messages','SELECT') then raise exception 'Client access to private plan data'; end if;
  insert into public.users(id,telegram_id,first_name) values(a,seed,'Plan QA A'),(b,seed-1,'Plan QA B'),(c,seed-2,'Plan QA C'),(d,seed-3,'Plan QA D');
  insert into public.profiles(user_id,name,age,city,gender,looking_for,bio,photo_url)
    select x,'Plan QA',28,'Київ','Чоловік','Усіх','Rollback QA profile',x::text||'/qa.jpg' from unnest(array[a,b,c,d]) x;
  input:=jsonb_build_object('client_nonce',gen_random_uuid(),'category','celebration','title','Private birthday QA','description','Synthetic plan','city','Київ','venue_label','Approximate area','visibility','private','meeting_details','SECRET QA ADDRESS','map_lat',50.46123,'map_lng',30.52345,'starts_at',now()+interval '2 hours','duration_hours',2,'capacity',2);
  r:=public.vybe_plan(a,'create',input);plan:=(r->'plan'->>'id')::uuid;
  if r->>'created'<>'true' or r::text like '%SECRET QA ADDRESS%' or (r->'plan'->>'map_lat')::numeric<>50.45 or (r->'plan'->>'map_lng')::numeric<>30.5 then raise exception 'Public card leaks private address or exact point'; end if;
  r:=public.vybe_plan(a,'create',input);if r->>'created'<>'false' or (select count(*) from public.vybe_plans where owner_id=a)<>1 then raise exception 'Retry duplicated plan'; end if;
  begin perform public.vybe_plan(a,'create',input||jsonb_build_object('title','Changed retry'));raise exception 'Nonce accepted changed input';exception when sqlstate '55000' then if sqlerrm<>'PLAN_RETRY_CHANGED' then raise;end if;end;
  r:=public.vybe_plan(b,'list','{}');if jsonb_array_length(r->'plans')<>1 or r::text like '%SECRET QA ADDRESS%' then raise exception 'Map leaked address';end if;
  r:=public.vybe_plan(b,'get',jsonb_build_object('plan_id',plan));if r::text like '%SECRET QA ADDRESS%' or r->'members'<>'[]'::jsonb or r->'messages'<>'[]'::jsonb then raise exception 'Outsider accessed members or address';end if;
  perform public.vybe_plan(b,'apply',jsonb_build_object('plan_id',plan,'note','PRIVATE REQUEST NOTE'));
  perform public.vybe_plan(b,'apply',jsonb_build_object('plan_id',plan,'note','Changed retry'));
  if (select count(*) from public.notification_events where recipient_user_id=a and payload->>'plan_id'=plan::text)<>1 then raise exception 'Request retry duplicated notification';end if;
  r:=public.vybe_plan(b,'get',jsonb_build_object('plan_id',plan));if r::text like '%SECRET QA ADDRESS%' or r->>'can_chat'<>'false' then raise exception 'Pending request accessed location';end if;
  r:=public.vybe_plan(c,'get',jsonb_build_object('plan_id',plan));if r::text like '%PRIVATE REQUEST NOTE%' then raise exception 'Request note leaked';end if;
  for r in select jsonb_build_object('action',x) from unnest(array['message','respond','cancel']) x loop
    begin perform public.vybe_plan(b,r->>'action',jsonb_build_object('plan_id',plan,'client_nonce',message_nonce,'body','No consent','user_id',c,'decision','approved'));raise exception 'Pending user performed privileged action';exception when insufficient_privilege then null;end;
  end loop;
  perform public.vybe_plan(c,'apply',jsonb_build_object('plan_id',plan,'note','Second application'));
  perform public.vybe_plan(a,'respond',jsonb_build_object('plan_id',plan,'user_id',b,'decision','approved'));
  perform public.vybe_plan(a,'respond',jsonb_build_object('plan_id',plan,'user_id',b,'decision','approved'));
  begin perform public.vybe_plan(a,'respond',jsonb_build_object('plan_id',plan,'user_id',c,'decision','approved'));raise exception 'Overbooked plan';exception when sqlstate '55000' then if sqlerrm<>'PLAN_FULL' then raise;end if;end;
  r:=public.vybe_plan(b,'get',jsonb_build_object('plan_id',plan));if r->'plan'->>'meeting_details'<>'SECRET QA ADDRESS' or r->>'can_chat'<>'true' or jsonb_array_length(r->'members')<>2 then raise exception 'Approved member cannot coordinate';end if;
  perform public.vybe_plan(b,'message',jsonb_build_object('plan_id',plan,'client_nonce',message_nonce,'body','SECRET GROUP MESSAGE'));
  perform public.vybe_plan(b,'message',jsonb_build_object('plan_id',plan,'client_nonce',message_nonce,'body','SECRET GROUP MESSAGE'));
  if (select count(*) from public.vybe_plan_messages where plan_id=plan)<>1 then raise exception 'Retry duplicated message';end if;
  r:=public.vybe_plan(c,'get',jsonb_build_object('plan_id',plan));if r::text like '%SECRET%' or r->'messages'<>'[]'::jsonb then raise exception 'Pending member accessed group';end if;
  update public.users set account_status='restricted' where id=b;
  begin perform public.vybe_plan(a,'respond',jsonb_build_object('plan_id',plan,'user_id',c,'decision','approved'));raise exception 'Restricted member seat silently reused';exception when sqlstate '55000' then if sqlerrm<>'PLAN_FULL' then raise;end if;end;
  r:=public.vybe_plan(a,'get',jsonb_build_object('plan_id',plan));
  if not exists(select 1 from jsonb_array_elements(r->'requests') q where q->>'user_id'=b::text and q->'profile'->>'unavailable'='true' and q->>'note'='') then raise exception 'Unavailable member details leaked or removal unavailable';end if;
  perform public.vybe_plan(a,'respond',jsonb_build_object('plan_id',plan,'user_id',b,'decision','rejected'));
  if (public.vybe_plan_card(plan,a)->>'approved_count')::integer<>1 then raise exception 'Cannot free unavailable member seat';end if;
  update public.users set account_status='active' where id=b;
  perform public.vybe_plan(a,'respond',jsonb_build_object('plan_id',plan,'user_id',b,'decision','approved'));
  perform public.vybe_plan(b,'leave',jsonb_build_object('plan_id',plan));
  r:=public.vybe_plan(b,'get',jsonb_build_object('plan_id',plan));if r::text like '%SECRET%' or r->>'can_chat'<>'false' then raise exception 'Former member retained access';end if;
  perform public.vybe_plan(a,'respond',jsonb_build_object('plan_id',plan,'user_id',c,'decision','approved'));
  insert into public.blocks(blocker_id,blocked_id) values(c,a);
  r:=public.vybe_plan(c,'list','{}');if jsonb_array_length(r->'plans')<>0 then raise exception 'Blocked plan remains on map';end if;
  begin perform public.vybe_plan(c,'get',jsonb_build_object('plan_id',plan));raise exception 'Blocked host address accessible';exception when insufficient_privilege then null;end;
  update public.blocks set blocker_id=d where blocker_id=c and blocked_id=a;
  perform public.vybe_plan(a,'respond',jsonb_build_object('plan_id',plan,'user_id',c,'decision','rejected'));
  r:=public.vybe_plan(c,'get',jsonb_build_object('plan_id',plan));if r::text like '%SECRET%' then raise exception 'Revoked member retained data';end if;
  begin perform public.vybe_plan(c,'apply',jsonb_build_object('plan_id',plan));raise exception 'Rejected user reapplied';exception when sqlstate '55000' then if sqlerrm<>'PLAN_REQUEST_DECLINED' then raise;end if;end;
  perform public.vybe_plan(a,'cancel',jsonb_build_object('plan_id',plan));
  if exists(select 1 from public.vybe_plan_locations where plan_id=plan and meeting_details<>'[cancelled]') then raise exception 'Cancelled address retained';end if;
  begin perform public.vybe_plan(b,'apply',jsonb_build_object('plan_id',plan));raise exception 'Joined cancelled plan';exception when sqlstate '55000' then if sqlerrm<>'PLAN_CLOSED' then raise;end if;end;
  if exists(select 1 from pg_catalog.pg_constraint k where k.contype='f' and k.conrelid in ('public.vybe_plans'::regclass,'public.vybe_plan_locations'::regclass,'public.vybe_plan_applications'::regclass,'public.vybe_plan_messages'::regclass) and k.confdeltype<>'c') then raise exception 'Plan data lacks cascading cleanup';end if;

end $$;
reset role;
select 'Plans privacy, capacity, consent, retries, blocks, cancellation and deletion assertions passed' as result;
rollback;
