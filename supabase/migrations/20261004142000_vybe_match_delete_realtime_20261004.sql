-- VYBE 0.9.36 — notify both users when a match is removed.
-- Prevent stale match/chat UI after owner beta reset or future relationship cleanup.

create or replace function public.vybe_broadcast_match_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic_a uuid;
  v_topic_b uuid;
begin
  select u.realtime_topic into v_topic_a
  from public.users u
  where u.id = old.user_a_id;

  select u.realtime_topic into v_topic_b
  from public.users u
  where u.id = old.user_b_id;

  if v_topic_a is not null then
    perform realtime.send(
      jsonb_build_object(
        'match_id', old.id,
        'changed_at', now(),
        'reason', 'match_removed'
      ),
      'relationship_changed',
      'vybe:user:' || v_topic_a::text,
      false
    );
  end if;

  if v_topic_b is not null then
    perform realtime.send(
      jsonb_build_object(
        'match_id', old.id,
        'changed_at', now(),
        'reason', 'match_removed'
      ),
      'relationship_changed',
      'vybe:user:' || v_topic_b::text,
      false
    );
  end if;

  return old;
end;
$$;

drop trigger if exists vybe_matches_removed_realtime on public.matches;
create trigger vybe_matches_removed_realtime
after delete on public.matches
for each row
execute function public.vybe_broadcast_match_removed();

revoke execute on function public.vybe_broadcast_match_removed()
  from public, anon, authenticated, service_role;
