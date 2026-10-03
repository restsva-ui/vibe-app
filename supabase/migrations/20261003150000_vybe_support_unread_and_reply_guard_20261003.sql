
alter table public.support_tickets
  add column if not exists user_seen_at timestamptz,
  add column if not exists admin_seen_at timestamptz,
  add column if not exists reply_sent_at timestamptz,
  add column if not exists reply_dispatch_key text;

create index if not exists support_tickets_user_reply_seen_idx
  on public.support_tickets(user_id,reply_sent_at,user_seen_at)
  where reply_sent_at is not null;

create index if not exists support_tickets_admin_seen_idx
  on public.support_tickets(admin_seen_at,created_at desc)
  where admin_seen_at is null;
