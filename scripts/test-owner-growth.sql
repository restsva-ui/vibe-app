-- Integration checks run as the production API role and roll back every test change.
begin;
set local role service_role;
do $$
declare v_owner uuid;v_a uuid:=gen_random_uuid();v_b uuid:=gen_random_uuid();
  v_tg bigint:=8000000000000+floor(random()*100000000)::bigint;
  v_before_users bigint;v_before_profiles bigint;v_uses bigint;v_result jsonb;v_batch jsonb;v_claim uuid;
begin
  select owner_user_id into strict v_owner from private.vybe_growth_settings where enabled;
  select count(*) into v_before_users from public.users;
  select count(*) into v_before_profiles from public.profiles;
  -- Isolate this rolled-back test batch from the real setup message.
  update private.vybe_growth_events set state='skipped' where state in ('pending','retry');
  insert into public.users(id,telegram_id,first_name) values(v_a,v_tg,'SQL QA'),(v_b,v_tg+1,'SQL QA');
  if (select count(*) from private.vybe_growth_events where subject_user_id in (v_a,v_b) and kind='user_registered')<>2 then raise exception 'registration trigger';end if;
  update public.users set last_seen=now() where id=v_a;
  if (select count(*) from private.vybe_growth_events where subject_user_id=v_a and kind='user_registered')<>1 then raise exception 'repeat login duplicated';end if;
  insert into public.profiles(user_id,name,age,bio) values(v_a,'SQL QA',28,'Rolled-back test');
  update public.profiles set bio='Edited rolled-back test' where user_id=v_a;
  delete from public.profiles where user_id=v_a;
  insert into public.profiles(user_id,name,age,bio) values(v_a,'SQL QA',28,'Recreated rolled-back test');
  if (select count(*) from private.vybe_growth_events where subject_user_id=v_a and kind='profile_created')<>1 then raise exception 'first profile duplicated';end if;
  v_result:=public.vybe_admin_growth_summary(v_owner);
  if (v_result->>'users_total')::bigint<>v_before_users+2 or (v_result->>'profiles_total')::bigint<>v_before_profiles+1 then raise exception 'exact counts';end if;
  begin perform public.vybe_admin_growth_summary(v_a);raise exception 'missing admin guard';exception when insufficient_privilege then null;end;

  select count(*) into v_uses from public.reward_uses where user_id=v_owner;
  v_result:=public.use_spotlight(v_owner);
  if (v_result->>'owner_access')::boolean is not true or (v_result->>'spotlight_until')::timestamptz<=now() then raise exception 'owner spotlight';end if;
  v_result:=public.vybe_like_and_match(v_owner,v_a,'super');
  if (v_result->>'owner_access')::boolean is not true or (v_result->>'super_charged')::boolean is not false or (v_result->>'like_created')::boolean is not true then raise exception 'owner super';end if;
  if (select count(*) from public.reward_uses where user_id=v_owner)<>v_uses then raise exception 'owner charged';end if;
  v_result:=public.vybe_like_and_match(v_owner,v_a,'super');
  if (v_result->>'like_created')::boolean or (v_result->>'like_upgraded')::boolean or (v_result->>'super_charged')::boolean then raise exception 'duplicate owner super';end if;
  begin perform public.use_spotlight(v_a);raise exception 'missing ordinary spotlight balance';exception when others then if sqlerrm<>'NO_SPOTLIGHT' then raise;end if;end;
  begin perform public.vybe_like_and_match(v_a,v_owner,'super');raise exception 'missing ordinary super balance';exception when others then if sqlerrm<>'NO_SUPERVYBE' then raise;end if;end;
  insert into public.admin_users(user_id,role) values(v_b,'admin');
  begin perform public.use_spotlight(v_b);raise exception 'admin received owner access';exception when others then if sqlerrm<>'NO_SPOTLIGHT' then raise;end if;end;
  insert into public.referral_rewards(user_id,milestone,reward_type,reward_amount) values(v_a,1,'supervybe',1),(v_a,3,'spotlight',1);
  v_result:=public.vybe_like_and_match(v_a,v_owner,'super');
  if (v_result->>'super_charged')::boolean is not true or (v_result->>'owner_access')::boolean is not false then raise exception 'ordinary super balance broken';end if;
  v_result:=public.use_spotlight(v_a);
  if (v_result->>'balance')::int<>0 or (v_result->>'owner_access')::boolean is not false then raise exception 'ordinary spotlight balance broken';end if;

  v_batch:=public.vybe_growth_claim();v_claim:=(v_batch->>'claim')::uuid;
  if jsonb_array_length(v_batch->'events')<>3 then raise exception 'batch size';end if;
  if public.vybe_growth_claim() is not null then raise exception 'claim duplicate';end if;
  if jsonb_array_length(public.vybe_growth_payload(v_claim)->'events')<>3 then raise exception 'payload';end if;
  update private.vybe_growth_settings set enabled=false;
  if public.vybe_growth_payload(v_claim) is not null then raise exception 'disabled delivery';end if;
  update private.vybe_growth_settings set enabled=true;
  perform public.vybe_growth_finish(gen_random_uuid(),'sent');
  if (select count(*) from private.vybe_growth_events where claim=v_claim and state='attempted')<>3 then raise exception 'wrong claim finalized';end if;
  perform public.vybe_growth_finish(v_claim,'retry',80);
  if (select count(*) from private.vybe_growth_events where claim=v_claim and state='retry' and retry_at>=now()+interval '80 seconds')<>3 then raise exception 'rate limit retry';end if;
  update private.vybe_growth_events set retry_at=now() where claim=v_claim;
  v_batch:=public.vybe_growth_claim();v_claim:=(v_batch->>'claim')::uuid;
  perform public.vybe_growth_finish(v_claim,'unknown');
  if public.vybe_growth_claim() is not null then raise exception 'ambiguous send replayed';end if;

  if has_table_privilege('anon','private.vybe_growth_events','SELECT') or has_table_privilege('authenticated','private.vybe_growth_settings','SELECT') then raise exception 'private data exposed';end if;
  if has_function_privilege('anon','public.vybe_growth_claim()','EXECUTE') or has_function_privilege('authenticated','public.vybe_admin_growth_summary(uuid)','EXECUTE') then raise exception 'public RPC exposed';end if;
end;
$$;
rollback;
select jsonb_build_object('result','owner growth/access integration checks passed; all test changes rolled back',
  'users',(select count(*) from public.users),'profiles',(select count(*) from public.profiles)) as checks;
