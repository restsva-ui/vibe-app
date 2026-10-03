
alter table public.support_tickets
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists admin_note text,
  add column if not exists reply_text text,
  add column if not exists resolved_by uuid references public.users(id) on delete set null;

create index if not exists support_tickets_category_status_created_idx
  on public.support_tickets(category,status,created_at desc);

create index if not exists support_tickets_resolved_by_idx
  on public.support_tickets(resolved_by)
  where resolved_by is not null;
