-- Notification pipeline indexes.
-- Covers per-chat unread mark_seen and remaining FK maintenance paths.

create index if not exists notification_events_unread_match_idx
  on public.notification_events(recipient_user_id, match_id)
  where seen_at is null and match_id is not null;

create index if not exists reports_resolved_by_idx
  on public.reports(resolved_by)
  where resolved_by is not null;

create index if not exists users_restricted_by_idx
  on public.users(restricted_by)
  where restricted_by is not null;
