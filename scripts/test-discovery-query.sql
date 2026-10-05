-- Synthetic rollback-only checks; no fixture is retained.
begin;
do $test$
declare
 ids uuid[] := array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 viewer uuid := ids[1]; i integer; n integer; page record; fn oid;
begin
 for i in 1..6 loop
  insert into public.users(id,telegram_id,first_name,last_seen,account_status)
   values(ids[i],-((('x'||substr(md5(ids[i]::text),1,14))::bit(56)::bigint)+1),'QA map',now(),case when i=5 then 'restricted' else 'active' end);
  insert into public.profiles(user_id,name,age,city,interests,map_enabled,map_lat,map_lng)
   values(ids[i],'QA-Interests-'||i,30,'QA-Interests',case when i in (1,2) then array['coffee','travel'] when i=3 then array['gaming'] else array['coffee'] end,
    i in (2,3,5,6),case when i=3 then 50.5 when i in (2,5,6) then 50.45 else null end,
    case when i=3 then 30.55 when i in (2,5,6) then 30.5 else null end);
  insert into public.intents(user_id,intent,expires_at) values(ids[i],'Поговорити',now()+interval '30 minutes');
 end loop;
 insert into public.blocks(blocker_id,blocked_id) values(viewer,ids[6]);
 select count(*) into n from public.vybe_discover_interests_page(
 p_user_id => viewer, p_min_age => 18, p_max_age => 99, p_city => 'QA-Interests',
 p_intent => null, p_online_only => false, p_verified_only => false,
 p_limit => 101, p_snapshot_at => now(), p_after_spotlight => null,
 p_after_spotlight_until => null, p_after_intent_match => null,
 p_after_online => null, p_after_verified => null, p_after_user_id => null,
 p_interests => array['coffee']::text[], p_common_only => true, p_map_only => false,
 p_south => 50.4, p_north => 50.6, p_west => 30.3, p_east => 30.7,
 p_after_common_count => null);
 if n<>2 then raise exception 'Shared-interest feed, blocks or restrictions failed: %',n;end if;
 select count(*) into n from public.vybe_discover_interests_page(
 p_user_id => viewer, p_min_age => 18, p_max_age => 99, p_city => 'QA-Interests',
 p_intent => null, p_online_only => false, p_verified_only => false,
 p_limit => 101, p_snapshot_at => now(), p_after_spotlight => null,
 p_after_spotlight_until => null, p_after_intent_match => null,
 p_after_online => null, p_after_verified => null, p_after_user_id => null,
 p_interests => array['coffee']::text[], p_common_only => true, p_map_only => true,
 p_south => 50.4, p_north => 50.6, p_west => 30.3, p_east => 30.7,
 p_after_common_count => null);
 if n<>1 then raise exception 'Opt-in map visibility failed: %',n;end if;
 select count(*) into n from public.vybe_discover_interests_page(
 p_user_id => viewer, p_min_age => 18, p_max_age => 99, p_city => 'QA-Interests',
 p_intent => null, p_online_only => false, p_verified_only => false,
 p_limit => 101, p_snapshot_at => now(), p_after_spotlight => null,
 p_after_spotlight_until => null, p_after_intent_match => null,
 p_after_online => null, p_after_verified => null, p_after_user_id => null,
 p_interests => array['gaming']::text[], p_common_only => false, p_map_only => true,
 p_south => 50.4, p_north => 50.6, p_west => 30.3, p_east => 30.7,
 p_after_common_count => null);
 if n<>1 then raise exception 'Explicit interest filtering failed: %',n;end if;
 select * into page from public.vybe_discover_interests_page(
 p_user_id => viewer, p_min_age => 18, p_max_age => 99, p_city => 'QA-Interests',
 p_intent => null, p_online_only => false, p_verified_only => false,
 p_limit => 1, p_snapshot_at => now(), p_after_spotlight => null,
 p_after_spotlight_until => null, p_after_intent_match => null,
 p_after_online => null, p_after_verified => null, p_after_user_id => null,
 p_interests => array['coffee']::text[], p_common_only => true, p_map_only => false,
 p_south => 50.4, p_north => 50.6, p_west => 30.3, p_east => 30.7,
 p_after_common_count => null);
 if page.user_id<>ids[2] or page.rank_common_count<>2 then raise exception 'Shared-interest ranking failed';end if;
 select count(*) into n from public.vybe_discover_interests_page(
 p_user_id => viewer, p_min_age => 18, p_max_age => 99, p_city => 'QA-Interests',
 p_intent => null, p_online_only => false, p_verified_only => false,
 p_limit => 10, p_snapshot_at => now(), p_after_spotlight => page.rank_spotlight,
 p_after_spotlight_until => page.rank_spotlight_until, p_after_intent_match => page.rank_intent_match,
 p_after_online => page.rank_online, p_after_verified => page.rank_verified, p_after_user_id => page.user_id,
 p_interests => array['coffee']::text[], p_common_only => true, p_map_only => false,
 p_south => 50.4, p_north => 50.6, p_west => 30.3, p_east => 30.7,
 p_after_common_count => page.rank_common_count);
 if n<>1 then raise exception 'Keyset pagination failed: %',n;end if;
 delete from public.blocks where blocker_id=viewer and blocked_id=ids[6];
 insert into public.blocks(blocker_id,blocked_id) values(ids[6],viewer);
 select count(*) into n from public.vybe_discover_interests_page(
 p_user_id => viewer, p_min_age => 18, p_max_age => 99, p_city => 'QA-Interests',
 p_intent => null, p_online_only => false, p_verified_only => false,
 p_limit => 101, p_snapshot_at => now(), p_after_spotlight => null,
 p_after_spotlight_until => null, p_after_intent_match => null,
 p_after_online => null, p_after_verified => null, p_after_user_id => null,
 p_interests => array['coffee']::text[], p_common_only => true, p_map_only => true,
 p_south => 50.4, p_north => 50.6, p_west => 30.3, p_east => 30.7,
 p_after_common_count => null);
 if n<>1 then raise exception 'Reverse-direction blocking failed';end if;
 insert into public.discovery_passes(user_id,target_user_id,target_intent_expires_at,passed_at) values(viewer,ids[2],now()+interval '30 minutes',now());
 select count(*) into n from public.vybe_discover_interests_page(
 p_user_id => viewer, p_min_age => 18, p_max_age => 99, p_city => 'QA-Interests',
 p_intent => null, p_online_only => false, p_verified_only => false,
 p_limit => 101, p_snapshot_at => now(), p_after_spotlight => null,
 p_after_spotlight_until => null, p_after_intent_match => null,
 p_after_online => null, p_after_verified => null, p_after_user_id => null,
 p_interests => array['coffee']::text[], p_common_only => true, p_map_only => true,
 p_south => 50.4, p_north => 50.6, p_west => 30.3, p_east => 30.7,
 p_after_common_count => null);
 if n<>0 then raise exception 'Passed profile resurfaced on map';end if;
 begin
  update public.profiles set interests=array['unsupported'] where user_id=viewer;
  raise exception 'Unsupported interest was stored';
 exception when check_violation then null;end;
 begin
  update public.profiles set map_enabled=true,map_lat=50.46,map_lng=30.5 where user_id=viewer;
  raise exception 'A precise coordinate was stored';
 exception when check_violation then null;end;
 select p.oid into fn from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname='vybe_discover_interests_page';
 if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE') then raise exception 'Discovery RPC is exposed';end if;
end;
$test$;
rollback;
