begin;
set local role service_role;
do $$
declare o uuid; t uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 tg bigint:=8200000000000+floor(random()*100000000)::bigint; r jsonb; uses bigint; orders bigint;
begin
 select user_id into strict o from public.admin_users where role='owner';
 insert into public.users(id,telegram_id,first_name) values(t,tg,'Test access QA'),(a,tg+1,'QA peer'),(b,tg+2,'QA peer');
 insert into private.vybe_test_access(user_id,granted_by) values(t,o);
 if not public.vybe_has_test_access(t) or public.vybe_has_test_access(a) then raise exception 'test grant boundary';end if;
 select count(*) into uses from public.reward_uses where user_id=t;
 select count(*) into orders from public.star_orders where user_id=t;
 r:=public.use_spotlight(t);
 if (r->>'test_access')::boolean is not true or (r->>'owner_access')::boolean is not false then raise exception 'tester spotlight access flags';end if;
 r:=public.vybe_like_and_match(t,a,'super');
 if (r->>'test_access')::boolean is not true or (r->>'owner_access')::boolean is not false or (r->>'super_charged')::boolean is not false then raise exception 'tester super charged';end if;
 if (select count(*) from public.reward_uses where user_id=t)<>uses or (select count(*) from public.star_orders where user_id=t)<>orders then raise exception 'test billing records';end if;
 if exists(select 1 from public.admin_users where user_id=t) then raise exception 'tester became admin';end if;
 begin perform public.vybe_owner_registrations(t);raise exception 'tester gained owner list';exception when insufficient_privilege then null;end;
 insert into public.blocks(blocker_id,blocked_id) values(t,b);
 begin perform public.vybe_like_and_match(t,b,'super');raise exception 'test bypassed block';exception when others then if sqlerrm<>'USER_BLOCKED' then raise;end if;end;
 delete from public.blocks where blocker_id=t and blocked_id=b;
 update private.vybe_test_access set enabled=false where user_id=t;
 if public.vybe_has_test_access(t) then raise exception 'revocation';end if;
 begin perform public.use_spotlight(t);raise exception 'revoked spotlight free';exception when others then if sqlerrm<>'NO_SPOTLIGHT' then raise;end if;end;
 begin perform public.vybe_like_and_match(t,b,'super');raise exception 'revoked super free';exception when others then if sqlerrm<>'NO_SUPERVYBE' then raise;end if;end;
 update private.vybe_test_access set enabled=true where user_id=t;
 update public.users set account_status='restricted',restriction_reason='spam' where id=t;
 if public.vybe_has_test_access(t) then raise exception 'restricted test grant active';end if;
 begin perform public.vybe_like_and_match(t,b,'super');raise exception 'restricted test';exception when others then if sqlerrm<>'USER_UNAVAILABLE' then raise;end if;end;
 if has_table_privilege('anon','private.vybe_test_access','SELECT')
  or has_table_privilege('authenticated','private.vybe_test_access','INSERT')
  or has_function_privilege('anon','public.vybe_has_test_access(uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.vybe_has_test_access(uuid)','EXECUTE') then raise exception 'test grant publicly exposed';end if;
end;
$$;
rollback;
select jsonb_build_object('result','test access, billing, revocation, owner boundaries and blocks passed; all fixtures rolled back','users',(select count(*) from public.users),'profiles',(select count(*) from public.profiles)) as checks;
