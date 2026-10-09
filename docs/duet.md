# VYBE duet — 0.9.49

Open an existing mutual VYBE chat and choose **VYBE-дует**. Either participant can invite the other. The second participant explicitly joins before answering. Each of three questions asks for a personal choice and a guess about the other participant. Participants can complete their parts at different times. A pair has one fixed first round; answers are immutable after saving.

Until both participants finish, the API returns only the requesting participant's answers and the other participant's progress. When both finish, it returns the three comparisons, shared-answer count and the requesting participant's correct-guess count. These are game results, not a compatibility assessment. The conversation button adds a question to the existing composer draft; it does not send a message automatically.

## Storage and authorization

- `vybe_duets` and `vybe_duet_answers` have RLS enabled and grant no access to `anon` or `authenticated`. The absence of client RLS policies is intentional: Telegram uses custom server authorization, and only the Edge Function's service role can access these tables.
- `vybe_duet(uuid,text,jsonb)` is `SECURITY INVOKER`, has an empty search path, and grants execution only to `service_role`. The verified Telegram user supplies the actor ID; request-body actor IDs are ignored.
- `vybe_chat_peer` checks match membership, both account statuses and blocking for every operation. Match-row locking serializes simultaneous starts and submissions. A unique match constraint prevents duplicate sessions; answer primary keys and immutable-answer checks make retries idempotent.
- Broadcast contains only `match_id`; no answers or guesses. The chat button reconciles on opening, foregrounding and once a minute; an open game reconciles every 15 seconds and after a Realtime signal.
- Match/account foreign keys cascade deletion of both the session and its answers. Product analytics record action names, never choices or guesses. Nothing is added to localStorage.

## Deployment

Apply `supabase/migrations/20261009151300_vybe_duet.sql`, deploy `telegram-auth` with its relative `_shared` dependencies, then publish the frontend. The migration filename matches production migration history. Keep `verify_jwt=false`: this existing function validates Telegram's signed initData in its body.

## Checks

Run `node scripts/test-duet-ui.cjs <directory-containing-jsdom-package.json>`. The test covers async navigation, offline retry, duplicate submissions, stale responses, composer preservation, language, focus isolation, media recording / incoming-call interruption, and the real `openChat` / Telegram Back integration.

Bundle `scripts/test-duet-api.ts` with the pinned esbuild version in CI and run it in Node. It exercises the real Edge Function handler with signed fixture initData and a network stub that rejects real network calls.

Run `scripts/test-duet.sql` on the linked project. It uses randomly generated synthetic accounts inside a transaction and rolls back all changes. Assertions cover consent, outsider access, hidden answers, retries, scoring, blocked/restricted accounts and deletion cascades.

For a phone check, use the existing two Telegram accounts: invite from one chat, finish that participant's questions, then join and finish from the other account. Results should appear on both sides. Closing the game should keep the chat and its draft. Physical Android/Telegram behavior needs device verification.
