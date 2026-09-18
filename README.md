# VYBE — Telegram Mini App MVP

VYBE is an 18+ social/dating Mini App concept focused on current intent instead of endless swiping.

## Core concept
Users set a current "vybe": talk, flirt, virtual intimacy, friendship, voice, night chat.

## MVP included
- Telegram WebApp SDK integration
- 18+ gate and community-rule acknowledgment
- discovery card stack and intent filters
- matches and chat mock screens
- profile/safety section
- VYBE+ / Spotlight / SuperVYBE monetization UI placeholders
- responsive mobile-first UI

## Safety requirements before production
Server-side age assurance where required, report/block, moderation, CSAM escalation procedures, NCII prohibition, anti-harassment/blackmail policy, no compensated sexual services, privacy/terms/deletion controls.

## Telegram payments
Digital goods/services inside Telegram must use Telegram Stars (XTR). Implement via Bot API sendInvoice / pre_checkout_query / successful_payment.

## Suggested production stack
Frontend: React + TypeScript + Vite. Backend: Cloudflare Workers or Supabase Edge Functions. DB: Supabase Postgres / Neon. Realtime: Supabase Realtime/WebSocket. Storage: Cloudflare R2/Supabase Storage. Analytics: PostHog.

## Local preview
Open index.html in a browser. Telegram-specific APIs degrade gracefully outside Telegram.

## Next milestones
1. Validate Telegram initData server-side
2. Profiles + onboarding
3. Matching algorithm
4. Realtime chat
5. Moderation/report/block
6. Stars billing
7. Admin console
8. Referrals/growth loops
