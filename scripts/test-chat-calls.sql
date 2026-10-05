-- Run on a linked dev project (or an authorized production rollback transaction).
-- No real accounts, media objects or Telegram notifications are touched.
begin;
insert into public.users(id,telegram_id,first_name) values
 ('11111111-1111-4111-8111-111111111111',-911001,'Media QA A'),
 ('22222222-2222-4222-8222-222222222222',-911002,'Media QA B'),
 ('33333333-3333-4333-8333-333333333333',-911003,'Media QA outsider');
insert into public.matches(id,user_a_id,user_b_id) values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
set local role service_role;
do $$
declare a uuid:='11111111-1111-4111-8111-111111111111'; b uuid:='22222222-2222-4222-8222-222222222222';
 outsider uuid:='33333333-3333-4333-8333-333333333333'; m uuid:='44444444-4444-4444-8444-444444444444';
 msg uuid:='55555555-5555-4555-8555-555555555555'; cid uuid; r jsonb; path text;
begin
 if has_function_privilege('anon','public.vybe_call(uuid,text,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.vybe_chat_peer(uuid,uuid)','EXECUTE') then raise exception 'RPC exposed'; end if;
 begin perform public.vybe_chat_peer(outsider,m); raise exception 'Outsider accessed match'; exception when insufficient_privilege then null; end;
 r:=public.vybe_call(a,'start',jsonb_build_object('match_id',m,'media_kind','audio')); cid:=(r->'call'->>'id')::uuid;
 if r->'call'->>'state'<>'ringing' then raise exception 'Not ringing'; end if;
 r:=public.vybe_call(b,'start',jsonb_build_object('match_id',m,'media_kind','audio'));
 if r->>'error'<>'CALL_BUSY' then raise exception 'Busy check failed'; end if;
 begin perform public.vybe_call(outsider,'poll',jsonb_build_object('call_id',cid)); raise exception 'Outsider read call'; exception when insufficient_privilege then null; end;
 begin perform public.vybe_call(a,'accept',jsonb_build_object('call_id',cid)); raise exception 'Caller accepted own call'; exception when insufficient_privilege then null; end;
 r:=public.vybe_call(b,'accept',jsonb_build_object('call_id',cid));
 if r->'call'->>'state'<>'accepted' then raise exception 'Accept failed'; end if;
 begin perform public.vybe_call(b,'signal',jsonb_build_object('call_id',cid,'kind','offer','payload',jsonb_build_object('type','offer','sdp',E'v=0\r\n'))); raise exception 'Callee created offer'; exception when insufficient_privilege then null; end;
 begin perform public.vybe_call(a,'signal',jsonb_build_object('call_id',cid,'kind','offer','payload',jsonb_build_object('type','offer','sdp',E'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'))); raise exception 'Audio call allowed video'; exception when raise_exception then if sqlerrm<>'INVALID_SDP' then raise; end if; end;
 perform public.vybe_call(a,'signal',jsonb_build_object('call_id',cid,'kind','offer','payload',jsonb_build_object('type','offer','sdp',E'v=0\r\n')));
 r:=public.vybe_call(b,'poll',jsonb_build_object('call_id',cid));
 if jsonb_array_length(r->'signals')<>1 then raise exception 'Peer did not receive offer'; end if;
 r:=public.vybe_call(a,'poll',jsonb_build_object('call_id',cid));
 if jsonb_array_length(r->'signals')<>0 then raise exception 'Signals echoed'; end if;
 perform public.vybe_call(b,'end',jsonb_build_object('call_id',cid));
 if exists(select 1 from public.chat_call_signals where call_id=cid) then raise exception 'Signals survived end'; end if;
 r:=public.vybe_call(a,'start',jsonb_build_object('match_id',m,'media_kind','video')); cid:=(r->'call'->>'id')::uuid;
 update public.chat_calls set created_at=now()-interval '61 seconds' where id=cid;
 r:=public.vybe_call(b,'accept',jsonb_build_object('call_id',cid));
 if r->>'error'<>'CALL_EXPIRED' then raise exception 'Expired call accepted'; end if;
 path:=a::text||'/'||m::text||'/qa.webm';
 insert into public.chat_media_cleanup(object_path) values(path);
 r:=public.vybe_send_media(a,m,msg,'voice',path,'audio/webm',1500,1000);
 if r->>'created'<>'true' or exists(select 1 from public.chat_media_cleanup where object_path=path) then raise exception 'Media commit failed'; end if;
 r:=public.vybe_send_media(a,m,msg,'voice',path,'audio/webm',1500,1000);
 if r->>'created'<>'false' or (select count(*) from public.messages where id=msg)<>1 then raise exception 'Retry duplicate'; end if;
 r:=public.vybe_call(a,'start',jsonb_build_object('match_id',m,'media_kind','audio')); cid:=(r->'call'->>'id')::uuid;
 insert into public.blocks(blocker_id,blocked_id) values(b,a);
 if (select state from public.chat_calls where id=cid)<>'ended' then raise exception 'Blocked call survived'; end if;
 begin perform public.vybe_chat_peer(a,m); raise exception 'Blocked media accessible'; exception when insufficient_privilege then null; end;
 delete from public.users where id=a;
 if not exists(select 1 from public.chat_media_cleanup where object_path=path) or exists(select 1 from public.messages where id=msg) then raise exception 'Deletion cleanup missing'; end if;
end $$;
reset role;
select 'Call/media authorization, state, expiry, idempotency and deletion assertions passed' as result;
rollback;
