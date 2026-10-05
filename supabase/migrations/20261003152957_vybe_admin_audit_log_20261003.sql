
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete restrict,
  action text not null,
  target_order_id uuid references public.star_orders(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_actor_created_idx
  on public.admin_audit_log(actor_user_id, created_at desc);

create index if not exists admin_audit_order_created_idx
  on public.admin_audit_log(target_order_id, created_at desc)
  where target_order_id is not null;

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;
grant select, insert, update, delete on table public.admin_audit_log to service_role;
