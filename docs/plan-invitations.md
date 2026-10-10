# Plan invitations, calendars and reminders — 0.9.52

In **Map → Plans**, hosts and approved members can open the invitation and calendar/reminder controls. Hosts must explicitly enable publication after reviewing the exact preview fields. Existing plans have no public invitation by default.

An invitation shares only the title, category, city, start/end time, capacity, occupied seats and public venue label. Private venues show a generic approximate-area label. No host profile, participant identity, coordinates, description, applications, notes, discussion or separately stored meeting address is returned. The opaque UUID is unguessable and cannot enumerate plans. The host can disable the invitation, which rotates the token; enabling it again never restores the old URL. Cancellation, restricted hosts and the start of a meetup make the preview unavailable. Authenticated preview calls also enforce both-way blocks. An anonymous preview cannot identify a blocked visitor; it contains only the host's deliberately published fields. Forwarded text and saved copies cannot be recalled.

The link opens a mobile invitation before the profile form. Telegram entry uses `/start plan_<token>` and a bot button for the exact invitation, without requiring a configured Main Mini App. Joining still requires the age gate, server-verified Telegram initData, a complete profile and host approval. Saving a profile returns to the same plan and never submits an application automatically. The token stays in the URL/memory until the flow finishes; it is not saved to localStorage or analytics.

Sharing uses a user-specific prepared inline message and Telegram's native share dialog when supported, otherwise its standard URL sharing. Cancelling the native dialog does not open a second dialog. Copying has a visible-link fallback. No message is sent until the user chooses to share.

Calendar downloads use a separate member-specific UUID capability and a real HTTPS `.ics` response for Telegram `downloadFile`; older clients use a regular download link. UTC event times and UTF-8 line folding follow RFC 5545. Calendar files omit home addresses and member lists. Leaving or losing approval rotates the token; restrictions, blocks, cancellation and event expiry also stop downloads. Already downloaded events are not automatically updated or deleted in another calendar app.

Reminders require explicit per-plan opt-in by the host or an approved member. They are due one hour before the start, or at the next scheduler run if enabled later. The minute Cron job makes an HTTP request only when eligible reminders exist. Its random 64-character hexadecimal credential stays in Vault; the service API stores a SHA-256 comparison hash. The public endpoint's worker POST validates this credential before claiming anything. All tables/RPCs are service-only with RLS, SECURITY INVOKER and an empty search path. No direct client database grants exist.

The worker atomically claims up to 50 reminders with row locks/SKIP LOCKED, creates one idempotent in-app notification, then checks membership, opt-in, account/block status and message-notification preferences again before a Telegram push. Explicit Telegram 429 responses respect `retry_after`, capped to one hour and three attempts while the plan has not started. Ambiguous transport failures are not replayed automatically, preventing duplicate sends at the cost of possible missed Telegram delivery. The in-app reminder remains available. Leaving or losing approval disables reminders. Pushes never include an address or message text.

Deploy the two invitation/schedule migrations, then `telegram-auth`, `telegram-bot` and `plan-invite`, before the frontend. `plan-invite` deliberately uses `verify_jwt=false` for its revocable GET capabilities and separately authenticated worker POST. The other functions retain their existing custom auth settings.

Validation:

- `scripts/test-plan-invites.sql`: real Postgres checks in a transaction that rolls back synthetic accounts; no Telegram calls or credential changes.
- `scripts/test-plan-invites-api.ts`: actual Edge handlers with signed Telegram fixtures and fully mocked network, covering actor spoofing, public-field whitelists, calendar escaping, worker authorization, preferences and 429 handling.
- `scripts/test-plan-invites-ui.cjs`: actual app integration for host publication, native sharing/cancel, downloads, opt-in, response races, restrictions, guest preview and onboarding return.
- `scripts/test-plans-browser.cjs`: actual Chromium at 320×568, 390×844 and 430×932 with mocked backend/tiles.

On a physical phone, enable an invitation in one account, share it to another, view it before completing the profile, apply and approve. Check the calendar import and an explicitly enabled reminder for a meetup starting in under an hour. Confirm that disabling a link and leaving a plan revoke access. Native Telegram sharing/download dialogs and real phone notification delivery require these device checks; browser fixtures do not confirm them.
