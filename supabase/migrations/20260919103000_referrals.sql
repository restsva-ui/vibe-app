-- VYBE referral system v1
-- One immutable referrer per referred user; activation is recorded separately.

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_id uuid not null references public.users(id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  constraint referrals_not_self check (referrer_id <> referred_id),
  constraint referrals_one_referrer unique (referred_id)
);

create unique index if not exists referrals_pair_idx
  on public.referrals(referrer_id, referred_id);

create index if not exists referrals_referrer_created_idx
  on public.referrals(referrer_id, created_at desc);

create index if not exists referrals_referrer_activated_idx
  on public.referrals(referrer_id, activated_at)
  where activated_at is not null;

alter table public.referrals enable row level security;

-- Referral reads/writes go only through the Telegram-authenticated Edge Function.
revoke all on table public.referrals from anon, authenticated;
