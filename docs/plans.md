# Meetups on the VYBE map — 0.9.51

Open **Map → Plans**. Switch between pins and the list, filter by category and the next 24 hours or week, or open **My plans** to see hosted meetups and applications. Anyone with a complete 18+ profile can create a plan: pizza, pub, walk, celebration, party, outdoors or other. Choose a future local date/time, 1–24-hour duration, 2–20 people including the host, city, public venue/area label, a manually selected map point, and member-only meeting details. Up to five active plans per host. The host approves every application. No romantic match or automatic like is required.

Approved members and the host get the meeting details, member list and a text-only group discussion. Pending/declined applicants get none of these. Request notes are visible only to the applicant and host. Leaving or revoking approval closes access. Cancellation closes joining and discussion and replaces stored meeting details with a cancellation marker. After a plan ends, the API stops returning the address; hourly cleanup replaces expired details with a marker. My plans includes the last 30 days of history. Plan/chat records remain linked to the host's account; deleting that account cascades the plan and its associated records. Deleting a participant removes their requests and messages.

## Privacy and access

Private venues use the same 0.05° area grid as the opt-in profile map; public venue pins are rounded to 0.001°. Exact meeting details are stored in a separate service-only table. The title, description, city and venue/area label are public to active authorized users, subject to blocks. The form explicitly asks hosts not to put a home address in those public fields. Members may save information they already received.

Four new tables have RLS and no client grants/policies. Six RPC/helpers use SECURITY INVOKER, an empty search path and service-role execution only. The Edge Function uses the actor from verified Telegram initData, discards request-body actor fields and enforces per-action limits. Both-way blocking and account restrictions apply to browsing, details, joining and discussion. Approval takes a plan-row lock before counting seats. Restricted/blocked approved members still occupy seats until the host removes them; their identity and request note are masked. Removing an unavailable approved member frees a seat without revealing their profile.

Create/message nonces and unique constraints prevent duplicate plans/messages on a retry; changed content with a saved nonce is rejected. Address/form/chat drafts stay in memory. Analytics contain action/category/visibility only. The open detail reconciles every 15 seconds while visible. Async responses are scoped to the mounted view so navigation disposes maps, polling and drafts safely.

In-app system events contain only kind and plan ID. Optional Telegram pushes follow the existing message-notification preference, use the atomic delivery ledger and a three-minute plan-push cooldown per recipient. Pushes contain an event description and protected plan link, without addresses or message text. Plan discussion doesn't create a dating match or send a private dating-chat message.

## Deployment and checks

Apply the five `vybe_plans_*` migrations in filename order. Their versions match production history. Deploy `telegram-auth` with `_shared/plans-api.ts` and the existing dependencies before publishing the frontend. The existing custom Telegram-auth function retains `verify_jwt=false` and verifies signed initData itself.

- `scripts/test-plans.sql` runs randomly generated synthetic accounts in a transaction that always rolls back. It checks location rounding, consent, private notes/addresses/chat, capacity, retries, restrictions, blocks, revocation, cancellation and the cascade constraints. It performs no actual account deletion.
- `scripts/test-plans-api.ts` exercises the actual Edge Function with signed fixture initData and a network stub; no real network or Telegram sends.
- `node scripts/test-plans-ui.cjs <jsdom dependency directory>` checks app integration, escaping, pending/member visibility, failures, message retries, creation and drafts.
- `node scripts/test-plans-browser.cjs <playwright/chromium dependency directory> <output directory>` uses actual app/Leaflet files with all network requests mocked at 320×568, 390×844 and 430×932. It checks maps, applications, member chat, private creation, approval, cancellation and layout. Map tiles in these screenshots are fixtures.

For a physical phone check, create a plan in one Telegram account, request to join from a second, approve it, then exchange a group message. Verify that the address is hidden before approval and disappears after leaving/removal/cancellation. Physical Telegram/Android testing and notification delivery depend on those accounts and devices.
