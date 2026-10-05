# Voice and video in VYBE

Chat now supports voice recordings up to 2 minutes (4 MiB), video recordings up to 1 minute (12 MiB), voice calls and video calls up to 30 minutes. The microphone/camera opens only after a button press and device permission. Calls are available between members of an active mutual match. The Mini App must be open to answer; Telegram message notifications can invite someone back but are not native OS call notifications. Background behavior depends on Telegram and the device.

## Storage and access

The `chat-media` bucket is private. The authenticated Telegram API verifies match membership, account status and blocks before uploading or creating a signed recording URL. URLs expire in 180 seconds; a recipient can still save or forward received media. Client SQL access is denied by RLS; all new RPCs are service-role only. A stable message UUID prevents duplicate sends. The server validates IDs, MIME allowlists, container headers, byte limits and declared duration; it does not decode the entire uploaded media to verify codecs or actual duration. No media, SDP, ICE or storage URLs enter product analytics or Realtime broadcasts.

Storage deletion uses an outbox and the Storage API. Cascading message deletion queues each object; app entry, uploads and account deletion retry the queue. Failed/incomplete upload reservations expire after 15 minutes. This handles network failures without directly deleting `storage.objects`. Failed deletions remain queued until a subsequent API entry; this is eventual cleanup, not guaranteed immediate erasure.

## Calls and relay configuration

WebRTC encrypts media in transit. VYBE does not record calls. The database temporarily stores authenticated SDP/ICE signaling and deletes it at termination or expiry; ended call metadata is removed after about a day. Ringing expires after 60 seconds; accepted calls expire after 90 seconds without a participant heartbeat or 30 minutes total. Blocks and account restrictions terminate calls. A minute cron handles abandoned sessions.

Without relay credentials, the API returns Cloudflare STUN and uses direct connections. Some NATs, mobile carriers and restricted Wi-Fi networks require TURN; direct calls may fail there. A direct connection can reveal participants' network IP addresses to each other. A failed connection stops local tracks and offers a recording fallback.

For relay support, set **server-side Supabase Edge Function secrets** through the Supabase dashboard or a trusted CLI environment. Never paste API keys into chat, commit them, or put them in browser code.

Choose one option:

* Cloudflare TURN: `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN`. The server requests one-hour credentials at `https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate-ice-servers`.
* A coturn service using TURN REST authentication: `TURN_URLS` (comma-separated `turn:`/`turns:` URLs) and `TURN_SHARED_SECRET`. The server signs a timestamp/user identifier with HMAC-SHA1 and issues one-hour credentials.

Configured relay mode uses `iceTransportPolicy: relay`, keeping direct peer IP addresses out of the media connection. Calls are limited to 30 minutes, below credential lifetime. No provider subscription or billing setup is included in this code change. Provider charges and account configuration remain separate decisions.

## Verification

`test-chat-media.ts` covers malformed IDs, MIME/container/size/time boundaries, protected URL issuance, authorization before upload, signal limits, credential secrecy, chunked request limits and a video MIME comma regression. `test-chat-calls.sql` runs state/access/block/expiry/idempotency/deletion assertions with disposable fixtures inside a rollback transaction. `test-webrtc-loopback.mjs` uses synthetic PCM and video frames with two native WebRTC peers and verifies decoded packets plus received RTP bytes; install its pinned optional test package as documented in the script. It needs a non-loopback network interface (some isolated execution sandboxes provide only loopback and WebRTC then gathers no candidates). CI runs it on Ubuntu.

Physical acceptance test: use two separate phones and Telegram accounts with a mutual VYBE. Send and play a voice recording, start/answer a voice call, mute/end it, then repeat for video. Check Wi-Fi and mobile data, reject permissions once, and close/reopen the Mini App. Real Android/iOS Telegram permission prompts and cross-carrier connectivity still require this device test; synthetic browser/native tests cannot establish them.
