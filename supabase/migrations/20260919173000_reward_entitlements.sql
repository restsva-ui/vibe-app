-- VYBE spendable referral rewards and entitlements
create table if not exists public.reward_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reward_type text not null check (reward_type in ('supervybe', 'spotlight')),
  reward_amount integer not null default 1 check (reward_amount > 0),
  used_at timestamptz not null default now()
);

create index if not exists reward_uses_user_type_idx
  on public.reward_uses(user_id, reward_type, used_at desc);

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  vybe_plus_until timestamptz,
  spotlight_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.reward_uses enable row level security;
alter table public.user_entitlements enable row level security;

revoke all on table public.reward_uses from anon, authenticated;
revoke all on table public.user_entitlements from anon, authenticated;

grant select, insert, update, delete on table public.reward_uses to service_role;
grant select, insert, update, delete on table public.user_entitlements to service_role;

-- Materialize any already-earned VYBE+ referral days once.
insert into public.user_entitlements (user_id, vybe_plus_until)
select
  rr.user_id,
  now() + make_interval(days => sum(rr.reward_amount)::int)
from public.referral_rewards rr
where rr.reward_type = 'vybe_plus'
group by rr.user_id
on conflict (user_id) do update
set vybe_plus_until = greatest(coalesce(public.user_entitlements.vybe_plus_until, now()), now())
  + make_interval(days => excluded.vybe_plus_until::date - current_date),
    updated_at = now();
