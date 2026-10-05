
create table if not exists public.admin_users (
  user_id uuid primary key references public.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;
grant select, insert, update, delete on table public.admin_users to service_role;

create index if not exists admin_users_role_idx on public.admin_users(role);
