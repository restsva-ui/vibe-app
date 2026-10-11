# VYBE vibe quiz · 0.9.57

An optional five-question game lives in **Profile → Який твій вайб?**. Four results are available in Ukrainian and English: Spark, Explorer, Cozy and Talker. The highest answer count wins; ties use the first relevant answer. The game does not claim a psychological assessment or a measured compatibility percentage.

## Invitation flow

- `https://t.me/vybe_now_bot?start=qz_spark` opens the public quiz entry through the bot.
- Personal invitations use `qz_<result>_<existing-referral-code>`. The bot's launch button preserves both the result and referral in the Mini App URL.
- Signed Telegram launch parameters take precedence over URL and unsafe launch fields.
- An invited person confirms the existing 18+ gate and completes the required profile. The app then resumes the quiz, including the inviting result for a simple comparison.
- Only a valid existing referral code is passed to `referral_claim`; quiz and campaign tags are not sent as referral codes.
- Existing referral activation and the 1/3/5 milestone rewards remain in effect. No additional cash, Stars or welcome reward is created by taking or sharing the quiz.

## Sharing and privacy

`vibe_quiz_share` uses signed Telegram authentication, account restrictions, the action rate limiter and an adult profile check. The server derives the referral code and the prepared-message target from the authenticated Telegram identity. Client-supplied recipients, captions and image URLs are ignored. The action calls `savePreparedInlineMessage` only for an explicit native share request; it does not send a message.

The Mini App opens Telegram's sharing dialog when the user presses **Share my card**. Double taps are locked. Cancelling a native dialog does not launch a fallback or count as a successful share. Older clients, or an unsupported preparation response, can explicitly share a text invitation; copy remains available. Stories opens the native editor, without claiming that a story was published. The clickable story widget is requested only for a Premium user.

Eight public JPEG cards contain the VYBE brand, the result and the public bot address. They contain no name, profile image, city or bio. JPEG was selected to match `InlineQueryResultPhoto` requirements. Raw answers remain in memory; only the result key is stored locally under an account-specific key. Successful account deletion removes that result.

Quiz events use the existing product analytics opt-out. They record the coarse result and sharing method, without answers or referral identifiers. Quiz-origin sessions add `acquisition_source=telegram` and `acquisition_campaign=vibe_quiz` to existing conversion events.

## Verification

- `node scripts/test-vibe-quiz.cjs`: all 1024 answer combinations, malformed input and launch precedence.
- `node scripts/test-vibe-quiz-ui.cjs /tmp/vybe-emoji-test`: real app hydration, required completion, sharing cancellation, copy, language, old clients, stale responses and account restriction.
- Bundle/run `scripts/test-vibe-quiz-api.ts`: authenticated identity, invalid signatures, adult profile, rate limits, public field allowlist and native preparation fallback.
- `scripts/test-bot-branding.ts`: quiz welcome, existing referral/campaign/plan routes and webhook boundaries.
- `node scripts/test-vibe-quiz-browser.cjs`: real Chromium with fully isolated fixture network at 320×568, 390×844 and 430×932, including actual card decoding and horizontal overflow checks. Playwright and its Chromium headless shell must be available.

CI includes the unit, UI and API checks and the existing security/type checks. Native Telegram delivery and Stories publication still require confirmation in a real Telegram client; the local checks exercise their callbacks and cancellation behavior through fixtures.

`scripts/build-vibe-quiz-cards.cjs` reproducibly builds the committed JPEGs from the existing brand asset and a vector text layout; it requires Sharp.
