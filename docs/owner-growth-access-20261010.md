# VYBE — owner access and new-user visibility

Implemented on 10 October 2026 for the existing verified owner account.

## In the app

Profile → **Користувачі VYBE** opens exact database counts: registered users,
created profiles, registrations and profiles today in Kyiv time, registrations
in seven days, and users who opened the app in seven days. Refresh fetches a
new snapshot. This endpoint requires a server-verified admin or owner role.

The existing owner role grants VYBE+ (including received likes), unlimited
SuperVYBE and Spotlight without purchases. The UI displays unlimited access
and removes purchase controls. The server also rejects owner invoice creation.
Role membership is checked on every relevant request. Regular admins keep
their normal paid entitlements. Blocks, account restrictions and rate limits
continue to apply. No paid reward, fake order or revenue record is created.

## Telegram alerts

New rows in public.users and the first row in public.profiles queue separate
events for the configured owner. Repeat logins, profile edits and profile
recreation do not repeat an event for the same user ID. Existing records are
not backfilled. The queue stores IDs and delivery state without names,
profile content, photos, location or chat text.

The existing minute plan-reminder worker also delivers these alerts. It only
runs when eligible work exists. Up to 100 events form one owner digest to avoid
a burst of Telegram messages. Explicit rate limits retry at most three times.
An ambiguous send is not replayed automatically. Permissions are rechecked
immediately before sending. The setup event is labelled as setup, not a user.

Private queue/config tables use RLS with no client policies. Only service_role
can access them and execute the related RPCs. RPCs use security invoker and a
fixed empty search_path. The existing Vault credential authorizes worker POST;
public invite/calendar GET does not gain access to growth data.

Migration: 20261010192212_vybe_owner_growth_and_access.sql. Its local CLI-generated
filename was reconciled to the actual version assigned by the deployed migration.

## Verification

- 27 backend checks: role boundaries, request spoofing, owner invoice guard,
  accurate balances, private-data handling, batching and delivery failures.
- 19 UI checks: role visibility, counts beyond 1,000, refresh/retry, owner
  premium actions without funds, normal purchase UI and English translation.
- 32 invitation/calendar/reminder regression checks; Deno checks both functions.
- scripts/test-owner-growth.sql executes as service_role and rolls back every
  fixture. It checks first-insert deduplication, exact counters, owner and
  normal billing, claim idempotency, rate-limit retries, ambiguous failures
  and client privileges. Production counts stayed at 4 users and 2 profiles.
- Security advisor has no warnings/errors; the private tables intentionally
  have no client RLS policies.

## Daily TikTok delivery

The existing enabled daily task runs at 08:00 Europe/Kiev. In a full month,
days 1–20 use automatic publishing; remaining calendar days deliver the video
base, cover, caption, campaign link, posting time and native audio instructions
to this conversation. Actual shared monthly Metricool usage is checked first.
October started on 10 October: automatic slots through 29 October when quota
allows, manual files for 30–31 October. February follows its actual day count.
Native-only music is added in TikTok; the song is not distributed separately.
The task adapts to mature performance data and preserves the requirement for
moving people, a story, the VYBE spelling and relevant permitted trending audio.
