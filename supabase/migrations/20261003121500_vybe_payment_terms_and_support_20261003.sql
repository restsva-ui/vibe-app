
alter table public.star_orders
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  telegram_id bigint not null,
  category text not null check (category in ('general','payment')),
  message text not null check (char_length(message) between 3 and 1500),
  status text not null default 'open' check (status in ('open','reviewed','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_status_created_idx
  on public.support_tickets(status,created_at desc);
create index if not exists support_tickets_telegram_created_idx
  on public.support_tickets(telegram_id,created_at desc);

alter table public.support_tickets enable row level security;
revoke all on table public.support_tickets from anon,authenticated;
grant select,insert,update,delete on table public.support_tickets to service_role;
