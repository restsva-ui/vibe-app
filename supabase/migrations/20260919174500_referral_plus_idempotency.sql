-- Track which VYBE+ referral milestone has already been materialized.
alter table public.user_entitlements
  add column if not exists referral_plus_milestone integer not null default 0
  check (referral_plus_milestone >= 0);

-- Existing VYBE+ referral rewards were materialized by the prior migration.
update public.user_entitlements ue
set referral_plus_milestone = x.max_milestone,
    updated_at = now()
from (
  select user_id, max(milestone)::integer as max_milestone
  from public.referral_rewards
  where reward_type = 'vybe_plus'
  group by user_id
) x
where ue.user_id = x.user_id
  and ue.referral_plus_milestone < x.max_milestone;
