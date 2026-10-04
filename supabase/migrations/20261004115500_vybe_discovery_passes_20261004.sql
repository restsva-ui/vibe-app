create table if not exists public.discovery_passes (
  user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  target_intent_expires_at timestamptz not null,
  passed_at timestamptz not null default now(),
  primary key (user_id, target_user_id),
  constraint discovery_passes_no_self check (user_id <> target_user_id)
);

create index if not exists discovery_passes_user_expires_idx
  on public.discovery_passes (user_id, target_intent_expires_at desc);

alter table public.discovery_passes enable row level security;

revoke all on table public.discovery_passes from anon, authenticated;
grant select, insert, update, delete on table public.discovery_passes to service_role;
