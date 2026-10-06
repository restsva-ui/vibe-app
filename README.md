# VYBE — Telegram Mini App

VYBE is an 18+ Telegram Mini App for social discovery, dating, friendship and private conversations. The core UX is based on a user's current intent ("vybe") rather than endless generic swiping.

## Current beta — 0.9.47

Implemented and wired to production Supabase:

- Telegram Mini App authentication with server-side initData validation
- 18+ entry gate and legal/community pages
- profiles, profile photos, discovery filters and VYBE NOW intents
- Discovery shows only active VYBE NOW profiles, excludes existing matches, filters by the selected vibe, and remembers passes for the current intent session
- live Discovery cards show intent expiry, online state, verification and Spotlight prominence
- brand-safe localization keeps `VYBE` unchanged inside VYBE NOW and version labels
- Discovery has an actionable empty state with filter reset/refresh and avoids duplicate VYBE NOW calls to action
- reopening the app restores the active VYBE NOW mood filter and shows `Change` instead of `Set` while active
- chat loads the latest 200 messages in chronological order, clears chat unread immediately, and marks related in-app notifications seen when opened
- new matches sort by match creation time before the first message, typing auto-expires, read receipts are clearer, and a mutual VYBE opens a dedicated chat CTA
- temporary owner-only beta reset can clear exactly one owner test match, pair likes, chat/read state, discovery passes and related social notifications
- match deletion broadcasts `relationship_changed` to both users, and foreground resume immediately refreshes matches/discovery to prevent stale mutual-match UI
- like notifications use a contextual VYBE+ screen instead of the generic shop, and automatically route to chat if that like has since become a match
- likes, SuperVYBE, mutual matches and realtime chat
- unread chat counters and read state
- block/report flows enforced server-side
- VYBE+ "Who liked me", Spotlight and SuperVYBE entitlements
- Telegram Stars checkout, pre-checkout validation, successful-payment handling and refunds
- owner-only Stars finance dashboard using Telegram balance/transaction APIs
- referrals and reward milestones
- user support tickets plus owner/admin support center
- support deep links, unread badges, audit log and duplicate-reply protection
- moderation center with report workflow, admin alerts and owner-only account restriction/restore
- restricted accounts are removed from discovery/matches/VYBE+ likes and cannot use social actions
- privacy, community rules, terms and account deletion

## Safety model

VYBE is intended only for adults 18+.

User safety controls include:
- block
- report
- server-side block enforcement across discovery, matches and chat
- report reasons for fake profiles, spam, harassment, suspected minors, sexual services, illegal/dangerous content and other issues
- moderation queue with reviewed/resolved/dismissed states
- urgent handling visibility for suspected-minor and illegal-content reports
- owner-only account restriction and restore
- restricted users retain access to support and account deletion

Before any public production launch, jurisdiction-specific age-assurance requirements, abuse-response procedures, CSAM escalation/reporting obligations, NCII handling, and store/platform review requirements must still be verified operationally.

## Telegram Stars

Digital goods/services are sold using Telegram Stars (XTR).

Production flow:
1. VYBE creates a server-side order.
2. Telegram opens the native Stars invoice.
3. The bot validates `pre_checkout_query`.
4. Entitlements are granted only after `successful_payment`.
5. Telegram payment charge IDs are stored for reconciliation/refunds.
6. Owner finance uses Telegram as the source of truth for the live Stars balance.

## Backend

- Supabase Postgres
- Supabase Edge Functions: `telegram-auth`, `telegram-bot`
- Supabase Realtime
- Supabase Storage for profile photos
- PostHog product analytics
- GitHub Pages frontend deployment

Sensitive database operations use service-role server functions; browser clients do not receive the service-role key or bot token.

## Admin areas

Owner/admin accounts can access:
- Finance
- Support
- Moderation

High-impact actions are restricted further:
- Telegram Stars refunds: owner only
- Account restriction/restore: owner only

Administrative actions are written to `admin_audit_log`.

## Repository notes

Database changes are mirrored in `supabase/migrations/`.

The production Edge Function source is mirrored in:
- `supabase/functions/telegram-auth/index.ts`
- `supabase/functions/telegram-bot/index.ts`

The Mini App frontend currently uses the lightweight `index.html` / `app.js` / `styles.css` stack for fast beta iteration.

- Telegram message notification is no longer suppressed by a coarse 90-second last-seen rule; the per-chat 3-minute delivery cooldown remains to prevent notification spam.

- The `matches` endpoint now uses a single backend-only RPC for match/profile/online/unread/latest-message data instead of per-match N+1 queries.

- Discovery is now DB-side and keyset-paginated: 20 cards per page with a 3-card prefetch buffer, exact filters/ranking/exclusions in one backend-only RPC, and no arbitrary first-100-profile cap.

- Like and SuperVYBE writes now use one atomic like/match RPC with pair locking, idempotent match creation, idempotent SuperVYBE charging, and server-side prevention of the old `like(kind=super)` bypass.

- Notification pipeline uses backend-only RPCs for unread/list/mark-seen, FK-covering indexes for actor/match cleanup, and an atomic Telegram notification delivery claim so concurrent messages cannot bypass the per-chat cooldown.

- The notification pipeline now has a dedicated partial index for per-chat unread `mark_seen`, while delivery dedup/cooldown remain atomic and the remaining unindexed foreign keys are covered.

- Retention cleanup runs daily at 03:17 UTC via pg_cron: notification deliveries 30d, seen notification events 90d, unseen notification events 180d, expired intents +24h, expired discovery passes +7d, cron run history 14d. Chat messages are intentionally retained.

- Server-side anti-abuse rate limiting is enforced atomically after Telegram authentication: message_send 120/min, like 120/min, pass 180/min, SuperVYBE 60/min, reports 20/hour, support_create 6/hour, Stars invoice 10/10min, plus conservative limits for profile/admin/payment mutations. Rate-limit counters are private and expire after 7 days.
- Fixed a support runtime bug where `support_create` incorrectly referenced a report-only `block_requested` field/variable.

- Telegram Stars payment/refund flow is now idempotent and webhook-recoverable: payment/refund RPCs are SECURITY INVOKER + service_role-only, refunds use a claimed `refunding` state, Telegram `refunded_payment` finalizes grant revocation, late/replayed payment webhooks cannot re-grant after refund, and payment webhook setup fails closed when `TELEGRAM_WEBHOOK_SECRET` is missing.

- VYBE 0.9.41 adds owner-only deep finance reconciliation against up to 1000 Telegram Star transactions, checking payment/refund direction, amount, invoice payload, Telegram user, local grants, stuck refunding states, and orphan Telegram transactions. Confirmed Telegram refunds can be safely reconciled back into local state only after explicit owner confirmation.

- VYBE 0.9.45 hardens account deletion: social data/support/notifications/unpaid orders are removed transactionally; completed Stars orders are detached from the deleted user and retained only for refund/finance integrity; profile photos are deleted only after the database transaction succeeds, with retries; admin/owner self-deletion is blocked until the admin role is removed.

- Profile-photo uploads are now server-hardened: only normalized 900x900 WebP/JPEG payloads are accepted, EXIF/XMP/animated WebP payloads are rejected, upload rollback removes orphan files on DB failure, and successful replace/remove/account-delete flows clean the whole per-user Storage folder while keeping only the active photo.

- VYBE 0.9.46 uses private profile media: the profile-photos bucket is private, database rows store only object paths, and photos are returned through two-hour signed URLs across Profile, Discovery, Matches, Notifications, Who Liked, Public Profile, and Moderation. Foreground resume refreshes signed profile URLs.

- VYBE 0.9.47 hardens Supabase server-key handling for modern `sb_secret_` keys, caches CORS preflight responses, makes Realtime the primary social/chat transport with a two-minute fallback reconciliation only while Realtime is unavailable, and escapes referral response fields before HTML rendering.

- When `TELEGRAM_WEBHOOK_SECRET` is not configured, VYBE derives a deterministic SHA-256 webhook secret from the private bot token and self-registers the fixed Supabase bot webhook after deploy. The derived secret is never written to Git or logs; an explicitly configured webhook secret still takes precedence.

## Interests and map

Profiles can select up to eight of sixteen interests. Discovery supports an any-selected-interest filter, a shared-interest-only filter, and shared-interest ranking with a compatible keyset cursor.

The map opens from Discovery. It shows up to 100 active VYBE NOW profiles in the current viewport and preserves blocks, restrictions, likes, matches and discovery passes. Users manually choose an approximate area in their profile; visibility is off by default. The server snaps coordinates to a 0.05° grid and disabling visibility removes the coordinates. Device geolocation is not used.

Leaflet 1.9.4 is pinned locally under `vendor/leaflet` with its license. OpenStreetMap tiles load only while the map is open, honor normal browser caching, and display attribution. Profiles and interests are never sent to the tile provider.

Validation: `node scripts/test-discovery-preferences.ts`; `scripts/test-discovery-query.sql` contains rollback-only synthetic database checks for matching, opt-in visibility, restrictions, both block directions, passes, keyset pagination and coarse-coordinate constraints.


## Shared VYBE branding — 2026-10-06

The app and Telegram bot share the peach/ivory folded-ribbon V. The Mini App uses the compact WebP symbol in its header, launch screen and age gate, with an outlined SVG wordmark and self-contained SVG favicon. PNG is the source avatar; JPEG is the Telegram-compatible avatar and /start image.

Assets: `assets/vybe-symbol.webp`, `assets/vybe-wordmark.svg`, `assets/vybe-mark.svg`, `assets/vybe-avatar.png`, `assets/vybe-avatar.jpg`.

The bot sends the logo with its existing welcome caption and Mini App button. If Telegram cannot fetch the image, it falls back to the same text and launch button. Webhook authentication, language selection, referral URLs and payment/support commands retain their existing behavior.

Validation: `scripts/test-bot-branding.ts` covers unauthorized webhook requests, Ukrainian welcome, English referrals, image-delivery fallback, terms and retryable delivery errors.
