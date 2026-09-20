-- Per-user read cursor for real unread message counts.
create table if not exists public.match_reads (
  user_id uuid not null references public.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

create index if not exists match_reads_match_idx on public.match_reads(match_id);
alter table public.match_reads enable row level security;
revoke all on table public.match_reads from anon, authenticated;
grant select, insert, update, delete on table public.match_reads to service_role;
