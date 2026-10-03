
alter table public.reports
  add column if not exists block_requested boolean not null default false;
