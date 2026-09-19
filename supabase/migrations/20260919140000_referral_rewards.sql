-- VYBE referral rewards v1
-- Server-authoritative, idempotent milestone rewards.

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  milestone integer not null check (milestone in (1, 3, 5)),
  reward_type text not null check (reward_type in ('supervybe', 'spotlight', 'vybe_plus')),
  reward_amount integer not null check (reward_amount > 0),
  granted_at timestamptz not null default now(),
  constraint referral_rewards_once unique (user_id, milestone)
);

create index if not exists referral_rewards_user_idx
  on public.referral_rewards(user_id, granted_at desc);

alter table public.referral_rewards enable row level security;
revoke all on table public.referral_rewards from anon, authenticated;
grant select, insert, update, delete on table public.referral_rewards to service_role;
