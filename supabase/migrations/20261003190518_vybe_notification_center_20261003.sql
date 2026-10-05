
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in ('like','match','message','system')),
  match_id uuid references public.matches(id) on delete cascade,
  source_key text unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

create index if not exists notification_events_recipient_created_idx
  on public.notification_events(recipient_user_id,created_at desc);

create index if not exists notification_events_unread_idx
  on public.notification_events(recipient_user_id,created_at desc)
  where seen_at is null;

alter table public.notification_events enable row level security;
revoke all on table public.notification_events from anon, authenticated;
grant select, insert, update, delete on table public.notification_events to service_role;
