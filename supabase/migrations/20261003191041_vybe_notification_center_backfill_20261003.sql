
insert into public.notification_events(
  recipient_user_id,actor_user_id,event_type,match_id,source_key,payload,created_at,seen_at
)
select
  d.recipient_user_id,
  d.actor_user_id,
  d.event_type,
  d.match_id,
  d.source_key,
  '{}'::jsonb,
  d.created_at,
  null
from public.notification_deliveries d
where not exists (
  select 1 from public.notification_events e
  where d.source_key is not null and e.source_key=d.source_key
);
