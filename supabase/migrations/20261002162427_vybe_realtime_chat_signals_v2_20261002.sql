-- VYBE realtime chat signals v2.
-- Broadcast only minimal change notifications. Message bodies stay behind telegram-auth.

create or replace function public.vybe_broadcast_message_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match_topic uuid;
  v_user_a_topic uuid;
  v_user_b_topic uuid;
begin
  select
    m.realtime_topic,
    ua.realtime_topic,
    ub.realtime_topic
  into
    v_match_topic,
    v_user_a_topic,
    v_user_b_topic
  from public.matches m
  join public.users ua on ua.id = m.user_a_id
  join public.users ub on ub.id = m.user_b_id
  where m.id = new.match_id;

  if v_match_topic is not null then
    perform realtime.send(
      jsonb_build_object(
        'match_id', new.match_id,
        'sender_id', new.sender_id,
        'created_at', new.created_at
      ),
      'message_created',
      'vybe:match:' || v_match_topic::text,
      false
    );
  end if;

  if v_user_a_topic is not null then
    perform realtime.send(
      jsonb_build_object(
        'match_id', new.match_id,
        'sender_id', new.sender_id,
        'created_at', new.created_at
      ),
      'chat_changed',
      'vybe:user:' || v_user_a_topic::text,
      false
    );
  end if;

  if v_user_b_topic is not null then
    perform realtime.send(
      jsonb_build_object(
        'match_id', new.match_id,
        'sender_id', new.sender_id,
        'created_at', new.created_at
      ),
      'chat_changed',
      'vybe:user:' || v_user_b_topic::text,
      false
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.vybe_broadcast_message_created()
  from public, anon, authenticated, service_role;
