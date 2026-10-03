
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  likes_enabled boolean not null default true,
  matches_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
revoke all on table public.notification_preferences from anon, authenticated;
grant select, insert, update, delete on table public.notification_preferences to service_role;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in ('like','match','message')),
  match_id uuid references public.matches(id) on delete cascade,
  source_key text unique,
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_recipient_created_idx
  on public.notification_deliveries(recipient_user_id,created_at desc);

create index if not exists notification_deliveries_message_cooldown_idx
  on public.notification_deliveries(recipient_user_id,match_id,created_at desc)
  where event_type='message';

alter table public.notification_deliveries enable row level security;
revoke all on table public.notification_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.notification_deliveries to service_role;
