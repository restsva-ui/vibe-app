-- Synthetic accounts only, all changes and broadcasts roll back.
begin;
set local role service_role;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  m uuid := gen_random_uuid(); second_match uuid := gen_random_uuid(); cid uuid; r jsonb; peer jsonb;
  seed bigint := -900000000000 - floor(random()*100000000000)::bigint;
begin
  if has_function_privilege('anon','public.vybe_duet(uuid,text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.vybe_duet(uuid,text,jsonb)','EXECUTE')
    or has_table_privilege('anon','public.vybe_duets','SELECT')
    or has_table_privilege('authenticated','public.vybe_duet_answers','SELECT') then
    raise exception 'Private duet data is publicly accessible';
  end if;
  insert into public.users(id,telegram_id,first_name) values(a,seed,'Duet QA A'),(b,seed-1,'Duet QA B'),(outsider,seed-2,'Duet QA outsider');
  insert into public.matches(id,user_a_id,user_b_id) values(m,least(a,b),greatest(a,b));
  r := public.vybe_duet(a,'get',jsonb_build_object('match_id',m));
  if r->>'state'<>'not_started' or exists(select 1 from public.vybe_duets where match_id=m) then raise exception 'Reading a duet started a game'; end if;
  begin
    perform public.vybe_duet(a,'join',jsonb_build_object('match_id',m)); raise exception 'Joined missing duet';
  exception when sqlstate '55000' then if sqlerrm<>'DUET_NOT_STARTED' then raise; end if; end;
  r := public.vybe_duet(a,'start',jsonb_build_object('match_id',m)); cid:=(r->>'duet_id')::uuid;
  if r->>'state'<>'playing' or r->>'created'<>'true' or r->>'my_joined'<>'true' then raise exception 'Start did not join inviter'; end if;
  r := public.vybe_duet(a,'start',jsonb_build_object('match_id',m));
  if (r->>'duet_id')::uuid<>cid or r->>'created'<>'false' or (select count(*) from public.vybe_duets where match_id=m)<>1 then raise exception 'Duplicate session on retry'; end if;
  for r in select jsonb_build_object('operation',x) from unnest(array['get','start','join','answer']) x loop
    begin
      perform public.vybe_duet(outsider,r->>'operation',jsonb_build_object('match_id',m)); raise exception 'Outsider accessed duet';
    exception when insufficient_privilege then null; end;
  end loop;
  r:=public.vybe_duet(b,'get',jsonb_build_object('match_id',m));
  if r->>'state'<>'invited' or r->'my_answers'<>'[]'::jsonb or r->'results'<>'[]'::jsonb then raise exception 'Invitation state leaked answers'; end if;
  begin
    perform public.vybe_duet(b,'answer',jsonb_build_object('match_id',m,'question_index',0,'choice',1,'guess',0)); raise exception 'Answered without consent';
  exception when sqlstate '55000' then if sqlerrm<>'DUET_JOIN_REQUIRED' then raise; end if; end;
  begin
    perform public.vybe_duet(a,'answer',jsonb_build_object('match_id',m,'question_index',2,'choice',1,'guess',0)); raise exception 'Skipped questions';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.vybe_duet(a,'answer',jsonb_build_object('match_id',m,'question_index',0,'choice','0','guess',0)); raise exception 'Accepted coerced choice';
  exception when invalid_parameter_value then null; end;
  perform public.vybe_duet(a,'answer',jsonb_build_object('match_id',m,'question_index',0,'choice',0,'guess',1));
  perform public.vybe_duet(a,'answer',jsonb_build_object('match_id',m,'question_index',0,'choice',0,'guess',1));
  if (select count(*) from public.vybe_duet_answers where duet_id=cid)<>1 then raise exception 'Retry duplicated answer'; end if;
  begin
    perform public.vybe_duet(a,'answer',jsonb_build_object('match_id',m,'question_index',0,'choice',1,'guess',1)); raise exception 'Changed locked answer';
  exception when sqlstate '55000' then if sqlerrm<>'DUET_ANSWER_LOCKED' then raise; end if; end;
  perform public.vybe_duet(a,'answer',jsonb_build_object('match_id',m,'question_index',1,'choice',0,'guess',1));
  r:=public.vybe_duet(a,'answer',jsonb_build_object('match_id',m,'question_index',2,'choice',1,'guess',1));
  if r->>'state'<>'waiting' or r->'results'<>'[]'::jsonb then raise exception 'Completed part leaked peer answers'; end if;
  r:=public.vybe_duet(b,'get',jsonb_build_object('match_id',m));
  if r->>'peer_progress'<>'3' or r->'results'<>'[]'::jsonb or r->'my_answers'<>'[]'::jsonb then raise exception 'Peer read answers before joining'; end if;
  perform public.vybe_duet(b,'join',jsonb_build_object('match_id',m));
  perform public.vybe_duet(b,'answer',jsonb_build_object('match_id',m,'question_index',0,'choice',1,'guess',0));
  r:=public.vybe_duet(b,'answer',jsonb_build_object('match_id',m,'question_index',1,'choice',0,'guess',1));
  if r->'results'<>'[]'::jsonb then raise exception 'Partial completion revealed results'; end if;
  r:=public.vybe_duet(b,'answer',jsonb_build_object('match_id',m,'question_index',2,'choice',1,'guess',1));
  peer:=public.vybe_duet(a,'get',jsonb_build_object('match_id',m));
  if r->>'state'<>'completed' or peer->>'state'<>'completed' or jsonb_array_length(r->'results')<>3
    or r->>'same_answers'<>'2' or peer->>'same_answers'<>'2' or r->>'guessed_correct'<>'2' or peer->>'guessed_correct'<>'2'
    or r->'results'->0->>'my_choice'<>peer->'results'->0->>'peer_choice' then raise exception 'Results are incorrect or asymmetric'; end if;
  update public.users set account_status='restricted' where id=b;
  begin perform public.vybe_duet(a,'get',jsonb_build_object('match_id',m)); raise exception 'Restricted peer accessed'; exception when insufficient_privilege then null; end;
  update public.users set account_status='active' where id=b;
  insert into public.blocks(blocker_id,blocked_id) values(b,a);
  begin perform public.vybe_duet(a,'get',jsonb_build_object('match_id',m)); raise exception 'Blocked duet accessed'; exception when insufficient_privilege then null; end;
  delete from public.blocks where blocker_id=b and blocked_id=a;
  delete from public.matches where id=m;
  if exists(select 1 from public.vybe_duets where id=cid) or exists(select 1 from public.vybe_duet_answers where duet_id=cid) then raise exception 'Match deletion retained private answers'; end if;
  insert into public.matches(id,user_a_id,user_b_id) values(second_match,least(a,b),greatest(a,b));
  r:=public.vybe_duet(a,'start',jsonb_build_object('match_id',second_match)); cid:=(r->>'duet_id')::uuid;
  perform public.vybe_duet(a,'answer',jsonb_build_object('match_id',second_match,'question_index',0,'choice',0,'guess',1));
  delete from public.users where id=a;
  if exists(select 1 from public.vybe_duets where id=cid) or exists(select 1 from public.vybe_duet_answers where duet_id=cid) then raise exception 'Account deletion retained private answers'; end if;
end $$;
reset role;
select 'Duet consent, privacy, access, scoring, retries and deletion assertions passed' as result;
rollback;
