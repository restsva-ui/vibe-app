# TikTok campaign measurement

VYBE uses a distinct Telegram bot link for each video. For example:

`https://t.me/vybe_now_bot?start=tt_261011_plans`

The bot accepts only a 64-character-or-shorter `tt_` payload made of ASCII letters, digits and underscores, and only in the sender's private chat. The welcome button passes the tag as a `campaign` query parameter. Referral rewards and plan invitations retain their separate launch paths.

The frontend reads the tag from Telegram launch data or the welcome URL, associates it with the authenticated account and retains the latest tagged entry for seven days. Events use the same backend user UUID already used by existing product analytics. Campaign properties contain only a source and a video code: `campaign_source`, `campaign_id`, `utm_source`, `utm_medium`, `utm_campaign`. No full URL, initData, name, bio, location or message text is added. Opt-out stops capture and clears the saved campaign; account deletion also clears it. Storage failures do not block app startup.

`app_open` measures authenticated app openings, not raw link clicks. `profile_created` fires after the first successful profile save; `profile_saved` also includes `is_first_profile` so edits remain distinguishable. The tag follows later product events such as likes, chats and plans within the attribution window.

Direct bot searches and untagged links are unattributed. TikTok captions may not offer clickable links, so a video-to-app click-through rate cannot be inferred from views alone. Separate tracked links must actually be used. Campaign-attributed app users / video views is an observed tracked-entry rate, not a complete TikTok click-through rate.

## Improving the next videos

Use Metricool for video views/reach, completion rate, average watch time, likes, comments and shares. Use PostHog project 291610 for unique `app_open` and `profile_created` users by campaign. Compare videos at similar ages: an initial read after 48–72 hours and another after seven days. Prefer new profiles and useful app actions; high reach alone is not a successful acquisition result.

Before generating a new video, keep the topic/hook that attracted interested users and test one changed variable, such as the opening sentence or CTA. Do not declare a winning format from a tiny sample. Missing metrics remain missing, not zero. New-account posting times start with Metricool recommendations and are revised after actual posts accumulate.

Music is mandatory: confirm a current relevant trend and TikTok commercial eligibility before scheduling. The three initial posts remain drafts until native music is selected. Business accounts can use Metricool's TikTok Top 100 selector; personal video posts require audio in TikTok. Browser authentication is separate from the connected plugin.

Sources:
- https://help.metricool.com/how-to-add-music-to-your-tiktok-posts-from-metricool-kap4e
- https://core.telegram.org/bots/features#deep-linking
- https://posthog.com/docs/web-analytics/campaign-attribution-troubleshooting
