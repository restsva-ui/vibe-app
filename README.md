# VYBE — Telegram Mini App

VYBE is an 18+ Telegram Mini App for social discovery, dating, friendship and virtual communication. The core UX is based on a user's current intent ("vybe") rather than endless generic swiping.

## Current beta — 0.9.36

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
