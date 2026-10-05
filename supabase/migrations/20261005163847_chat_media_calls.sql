-- Telegram custom authentication: only telegram-auth's service role can access media/signaling.
alter table public.messages add column kind text not null default 'text',
  add column media_path text, add column media_mime text, add column duration_ms integer, add column media_bytes integer;
alter table public.messages add constraint messages_media_valid check (
  (kind='text' and media_path is null and media_mime is null and duration_ms is null and media_bytes is null)
  or (kind in ('voice','video') and media_path is not null and media_path like sender_id::text || '/' || match_id::text || '/%'
    and duration_ms between 250 and case when kind='voice' then 120000 else 60000 end
    and media_bytes between 32 and case when kind='voice' then 4194304 else 12582912 end
    and media_mime = any(case when kind='voice' then array['audio/webm','audio/ogg','audio/mp4'] else array['video/webm','video/mp4'] end)));
create unique index messages_media_path_unique on public.messages(media_path) where media_path is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-media','chat-media',false,12582912,array['audio/webm','audio/ogg','audio/mp4','video/webm','video/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.chat_media_cleanup(object_path text primary key, delete_after timestamptz not null default now());
alter table public.chat_media_cleanup enable row level security;
revoke all on public.chat_media_cleanup from public,anon,authenticated;
grant all on public.chat_media_cleanup to service_role;
comment on table public.chat_media_cleanup is 'Storage deletion outbox; service role only. Upload reservations expire after 15 minutes.';
create function public.vybe_queue_media_delete() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.media_path is not null then
   insert into public.chat_media_cleanup(object_path) values(old.media_path) on conflict(object_path) do update set delete_after=now();
 end if;
 return old;
end $$;
create trigger queue_media_delete after delete on public.messages for each row execute function public.vybe_queue_media_delete();
revoke execute on function public.vybe_queue_media_delete() from public,anon,authenticated;
grant execute on function public.vybe_queue_media_delete() to service_role;

create function public.vybe_chat_peer(p_user uuid,p_match uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_peer uuid;
begin
 select case when m.user_a_id=p_user then m.user_b_id else m.user_a_id end into v_peer
 from public.matches m join public.users a on a.id=m.user_a_id join public.users b on b.id=m.user_b_id
 where m.id=p_match and p_user in(m.user_a_id,m.user_b_id) and a.account_status='active' and b.account_status='active'
 and not exists(select 1 from public.blocks x where (x.blocker_id=m.user_a_id and x.blocked_id=m.user_b_id) or (x.blocker_id=m.user_b_id and x.blocked_id=m.user_a_id));
 if v_peer is null then raise exception 'CHAT_UNAVAILABLE' using errcode='42501'; end if;
 return v_peer;
end $$;
revoke execute on function public.vybe_chat_peer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vybe_chat_peer(uuid,uuid) to service_role;

create function public.vybe_send_media(p_user uuid,p_match uuid,p_id uuid,p_kind text,p_path text,p_mime text,p_duration integer,p_bytes integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_message public.messages; v_peer uuid;
begin
 v_peer:=public.vybe_chat_peer(p_user,p_match);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('media:'||p_id::text,0));
 select * into v_message from public.messages where id=p_id;
 if found then
   if v_message.sender_id<>p_user or v_message.match_id<>p_match or v_message.kind<>p_kind then raise exception 'INVALID_ID'; end if;
   return jsonb_build_object('created',false,'id',v_message.id,'peer_id',v_peer);
 end if;
 insert into public.messages(id,match_id,sender_id,kind,body,media_path,media_mime,duration_ms,media_bytes)
 values(p_id,p_match,p_user,p_kind,case when p_kind='voice' then '🎙 Голосове повідомлення' else '🎥 Відеоповідомлення' end,p_path,p_mime,p_duration,p_bytes)
 returning * into v_message;
 delete from public.chat_media_cleanup where object_path=p_path;
 return jsonb_build_object('created',true,'id',v_message.id,'peer_id',v_peer);
end $$;
revoke execute on function public.vybe_send_media(uuid,uuid,uuid,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.vybe_send_media(uuid,uuid,uuid,text,text,text,integer,integer) to service_role;

create table public.chat_calls(
 id uuid primary key default gen_random_uuid(), match_id uuid not null references public.matches(id) on delete cascade,
 caller_id uuid not null references public.users(id) on delete cascade, callee_id uuid not null references public.users(id) on delete cascade,
 media_kind text not null check(media_kind in('audio','video')), state text not null default 'ringing' check(state in('ringing','accepted','ended','rejected','missed','failed')),
 created_at timestamptz not null default now(), accepted_at timestamptz, ended_at timestamptz,
 caller_seen timestamptz not null default now(), callee_seen timestamptz not null default now(),
 check(caller_id<>callee_id)
);
create index chat_calls_match on public.chat_calls(match_id);
create index chat_calls_caller on public.chat_calls(caller_id,created_at desc);
create index chat_calls_callee on public.chat_calls(callee_id,created_at desc);
create table public.chat_call_signals(
 id bigint generated always as identity primary key, call_id uuid not null references public.chat_calls(id) on delete cascade,
 sender_id uuid not null references public.users(id) on delete cascade,
 kind text not null check(kind in('offer','answer','ice')), payload jsonb not null check(octet_length(payload::text)<=70000), created_at timestamptz not null default now()
);
create index chat_call_signals_cursor on public.chat_call_signals(call_id,id);
create index chat_call_signals_sender on public.chat_call_signals(sender_id);
create unique index chat_call_one_description on public.chat_call_signals(call_id,kind) where kind in('offer','answer');
alter table public.chat_calls enable row level security;
alter table public.chat_call_signals enable row level security;
revoke all on public.chat_calls,public.chat_call_signals from public,anon,authenticated;
grant all on public.chat_calls,public.chat_call_signals to service_role;
grant usage,select on sequence public.chat_call_signals_id_seq to service_role;
comment on table public.chat_call_signals is 'Short lived WebRTC SDP/ICE. No media. API verifies participants; no client SQL policies.';

create function public.vybe_expire_calls() returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.chat_calls set state=case when state='ringing' then 'missed' else 'failed' end,ended_at=now()
 where (state='ringing' and created_at<now()-interval '60 seconds') or (state='accepted' and
 (caller_seen<now()-interval '90 seconds' or callee_seen<now()-interval '90 seconds' or accepted_at<now()-interval '30 minutes'));
 delete from public.chat_call_signals s using public.chat_calls c where s.call_id=c.id and c.state not in('ringing','accepted');
 delete from public.chat_calls where ended_at<now()-interval '1 day';
end $$;
revoke execute on function public.vybe_expire_calls() from public,anon,authenticated;
grant execute on function public.vybe_expire_calls() to service_role;
select cron.schedule('vybe-call-expiry','* * * * *','select public.vybe_expire_calls()');

create function public.vybe_call(p_user uuid,p_action text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.chat_calls; v_peer uuid; v_match uuid; v_signals jsonb; v_kind text; v_cursor bigint;
begin
 perform public.vybe_expire_calls();
 if p_action='start' then
   v_match:=(p_input->>'match_id')::uuid; v_peer:=public.vybe_chat_peer(p_user,v_match);
   -- Both people lock in the same order, including simultaneous calls in other chats.
   perform id from public.users where id in(p_user,v_peer) order by id for update;
   perform public.vybe_chat_peer(p_user,v_match);
   if exists(select 1 from public.chat_calls where state in('ringing','accepted') and (caller_id in(p_user,v_peer) or callee_id in(p_user,v_peer))) then
     return jsonb_build_object('ok',false,'error','CALL_BUSY');
   end if;
   v_kind:=p_input->>'media_kind';
   insert into public.chat_calls(match_id,caller_id,callee_id,media_kind) values(v_match,p_user,v_peer,v_kind) returning * into c;
 elsif p_action='poll' and nullif(p_input->>'call_id','') is null then
   select * into c from public.chat_calls where p_user in(caller_id,callee_id) and state in('ringing','accepted') order by created_at desc limit 1;
   if not found then return jsonb_build_object('ok',true,'call',null,'signals','[]'::jsonb); end if;
 else
   select * into c from public.chat_calls where id=(p_input->>'call_id')::uuid and p_user in(caller_id,callee_id) for update;
   if not found then raise exception 'CALL_UNAVAILABLE' using errcode='42501'; end if;
 end if;
 v_peer:=public.vybe_chat_peer(p_user,c.match_id);
 if p_action='accept' then
   if c.callee_id<>p_user then raise exception 'CALL_FORBIDDEN' using errcode='42501'; end if;
   if c.state='ringing' then update public.chat_calls set state='accepted',accepted_at=now(),caller_seen=now(),callee_seen=now() where id=c.id returning * into c;
   elsif c.state<>'accepted' then return jsonb_build_object('ok',false,'error','CALL_EXPIRED'); end if;
 elsif p_action='reject' or p_action='end' then
   if p_action='reject' and c.callee_id<>p_user then raise exception 'CALL_FORBIDDEN' using errcode='42501'; end if;
   if c.state in('ringing','accepted') then update public.chat_calls set state=case when p_action='reject' then 'rejected' else 'ended' end,ended_at=now() where id=c.id returning * into c; end if;
   delete from public.chat_call_signals where call_id=c.id;
 elsif p_action='signal' then
   if c.state<>'accepted' then return jsonb_build_object('ok',false,'error','CALL_EXPIRED'); end if;
   v_kind:=p_input->>'kind';
   if (v_kind='offer' and c.caller_id<>p_user) or (v_kind='answer' and c.callee_id<>p_user) then raise exception 'CALL_FORBIDDEN' using errcode='42501'; end if;
   if c.media_kind='audio' and coalesce(p_input->'payload'->>'sdp','') ~ E'(^|\\n)m=video' then raise exception 'INVALID_SDP'; end if;
   if (select count(*) from public.chat_call_signals where call_id=c.id and sender_id=p_user)>=150 then raise exception 'SIGNAL_LIMIT'; end if;
   insert into public.chat_call_signals(call_id,sender_id,kind,payload) values(c.id,p_user,v_kind,p_input->'payload') on conflict do nothing;
 elsif p_action not in('start','poll','config') then raise exception 'INVALID_CALL_ACTION';
 end if;
 if p_action='poll' and c.state='accepted' then
   update public.chat_calls set caller_seen=case when caller_id=p_user then now() else caller_seen end,
     callee_seen=case when callee_id=p_user then now() else callee_seen end where id=c.id;
 end if;
 v_cursor:=greatest(0,coalesce((p_input->>'cursor')::bigint,0));
 select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) into v_signals from
   (select id,kind,payload from public.chat_call_signals where call_id=c.id and sender_id<>p_user and id>v_cursor order by id limit 160) s;
 -- Object paths, Telegram identifiers and peer SDP never go into broadcast notifications.
 return jsonb_build_object('ok',true,'call',to_jsonb(c),'peer_id',v_peer,'signals',case when p_action='poll' then v_signals else '[]'::jsonb end);
end $$;
revoke execute on function public.vybe_call(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.vybe_call(uuid,text,jsonb) to service_role;

create function public.vybe_broadcast_call() returns trigger language plpgsql security invoker set search_path='' as $$
declare t uuid;
begin
 if tg_op='UPDATE' and new.state=old.state then return new; end if;
 for t in select realtime_topic from public.users where id in(new.caller_id,new.callee_id) loop
   perform realtime.send(jsonb_build_object('call_id',new.id,'match_id',new.match_id),'call_changed','vybe:user:'||t::text,false);
 end loop;
 return new;
end $$;
create trigger call_changed after insert or update on public.chat_calls for each row execute function public.vybe_broadcast_call();
revoke execute on function public.vybe_broadcast_call() from public,anon,authenticated;
grant execute on function public.vybe_broadcast_call() to service_role;
create function public.vybe_stop_unavailable_calls() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='blocks' then
   update public.chat_calls set state='ended',ended_at=now() where state in('ringing','accepted') and
   ((caller_id=new.blocker_id and callee_id=new.blocked_id) or (callee_id=new.blocker_id and caller_id=new.blocked_id));
 elsif new.account_status='restricted' then
   update public.chat_calls set state='ended',ended_at=now() where state in('ringing','accepted') and new.id in(caller_id,callee_id);
 end if;
 delete from public.chat_call_signals s using public.chat_calls c where s.call_id=c.id and c.state not in('ringing','accepted');
 return new;
end $$;
create trigger stop_blocked_calls after insert on public.blocks for each row execute function public.vybe_stop_unavailable_calls();
create trigger stop_restricted_calls after update of account_status on public.users for each row execute function public.vybe_stop_unavailable_calls();
revoke execute on function public.vybe_stop_unavailable_calls() from public,anon,authenticated;
grant execute on function public.vybe_stop_unavailable_calls() to service_role;
