
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in ('like','match','message','system')),
  match_id uuid references public.matches(id) on delete cascade,
  source_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_user_created_idx
  on public.app_notifications(user_id,created_at desc);

create index if not exists app_notifications_user_unseen_idx
  on public.app_notifications(user_id,created_at desc)
  where seen_at is null;

alter table public.app_notifications enable row level security;
revoke all on table public.app_notifications from anon, authenticated;
grant select, insert, update, delete on table public.app_notifications to service_role;
