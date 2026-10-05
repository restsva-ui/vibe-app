
alter table public.users
  add column if not exists account_status text not null default 'active',
  add column if not exists restricted_at timestamptz,
  add column if not exists restriction_reason text,
  add column if not exists restricted_by uuid references public.users(id) on delete set null;

alter table public.users
  drop constraint if exists users_account_status_check;
alter table public.users
  add constraint users_account_status_check
  check (account_status in ('active','restricted'));

alter table public.reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists admin_note text,
  add column if not exists resolved_by uuid references public.users(id) on delete set null,
  add column if not exists admin_seen_at timestamptz;

alter table public.admin_audit_log
  add column if not exists target_report_id uuid references public.reports(id) on delete set null,
  add column if not exists target_user_id uuid references public.users(id) on delete set null;

create index if not exists reports_status_created_idx
  on public.reports(status,created_at desc);

create index if not exists reports_reported_created_idx
  on public.reports(reported_id,created_at desc);

create index if not exists reports_admin_unseen_idx
  on public.reports(admin_seen_at,created_at desc)
  where admin_seen_at is null;

create index if not exists users_account_status_idx
  on public.users(account_status)
  where account_status <> 'active';

create index if not exists admin_audit_report_created_idx
  on public.admin_audit_log(target_report_id,created_at desc)
  where target_report_id is not null;

create index if not exists admin_audit_user_created_idx
  on public.admin_audit_log(target_user_id,created_at desc)
  where target_user_id is not null;
