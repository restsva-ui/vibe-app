
alter table public.admin_audit_log
  add column if not exists target_ticket_id uuid references public.support_tickets(id) on delete set null;

create index if not exists admin_audit_ticket_created_idx
  on public.admin_audit_log(target_ticket_id,created_at desc)
  where target_ticket_id is not null;
