# VYBE production migration baseline — 2026-10-05

This file records the migration-history state observed in production Supabase project `qifxxzpnuxchnkowxzgp` during the VYBE 0.9.47 hardening audit.

## Rules

- The production-tracked versions below must remain represented by files in `supabase/migrations/`.
- Migration filenames were normalized to the production version timestamps without changing their SQL blob contents.
- Do not edit `supabase_migrations.schema_migrations` manually to hide drift.
- New production DDL must be introduced as a migration first; avoid out-of-band schema changes.
- The repository also contains bootstrap migrations created before production migration history was tracked and several 2026-10-04 out-of-band hardening migrations. They are retained for clean rebuilds but are not falsely inserted into production history.
- `20261003122312` is a no-op marker because production contains a duplicate history entry for the preceding star-order cancel-state migration.

## Production-tracked versions

- `20261002140636` — `vybe_production_hardening_20261002`
- `20261002155153` — `vybe_safety_core_20261002`
- `20261002161917` — `vybe_realtime_chat_20261002`
- `20261002162427` — `vybe_realtime_chat_signals_v2_20261002`
- `20261002164124` — `vybe_profile_media_and_discovery_indexes_20261002`
- `20261003113424` — `vybe_telegram_stars_commerce_20261003`
- `20261003113931` — `vybe_plus_who_liked_copy_20261003`
- `20261003114109` — `index_star_orders_product_key_20261003`
- `20261003114254` — `vybe_payment_terms_and_support_20261003`
- `20261003114532` — `index_support_tickets_user_20261003`
- `20261003122259` — `vybe_star_order_cancel_state_20261003`
- `20261003122312` — `vybe_star_order_cancel_state_20261003`
- `20261003122748` — `vybe_one_star_refund_test_20261003`
- `20261003152803` — `vybe_admin_finance_roles_20261003`
- `20261003152957` — `vybe_admin_audit_log_20261003`
- `20261003164022` — `vybe_support_center_20261003`
- `20261003164054` — `vybe_support_audit_target_20261003`
- `20261003173109` — `vybe_support_unread_and_reply_guard_20261003`
- `20261003173530` — `vybe_support_reply_backfill_20261003`
- `20261003175045` — `vybe_moderation_center_20261003`
- `20261003181702` — `vybe_report_block_requested_20261003`
- `20261003185009` — `vybe_social_notifications_20261003`
- `20261003190518` — `vybe_notification_center_20261003`
- `20261003190750` — `vybe_in_app_notifications_20261003`
- `20261003190856` — `vybe_remove_unused_app_notifications_20261003`
- `20261003191041` — `vybe_notification_center_backfill_20261003`
- `20261004090101` — `vybe_discovery_passes`
- `20261004090121` — `vybe_discovery_passes_target_index`
- `20261004111209` — `vybe_match_delete_realtime`
- `20261004155124` — `vybe_retention_cleanup`
- `20261004160010` — `vybe_rate_limit_guard`
- `20261004161109` — `vybe_star_payment_refund_hardening`
- `20261004172219` — `vybe_account_deletion_hardening`
- `20261004174853` — `vybe_profile_photo_hardening`
- `20261004180004` — `vybe_private_profile_photos`

## Known repository-only migrations at baseline

Bootstrap / pre-history:
- `20260919060000_social_core.sql`
- `20260919103000_referrals.sql`
- `20260919140000_referral_rewards.sql`
- `20260919173000_reward_entitlements.sql`
- `20260919174500_referral_plus_idempotency.sql`
- `20260920171000_match_reads.sql`
- `20260920183500_atomic_supervybe.sql`
- `20260926161500_atomic_spotlight.sql`

Other repository-only files:
- `20261003131500_enable_one_star_supervybe_test_20261003.sql`
- `20261004170000_vybe_matches_rpc_optimization.sql`
- `20261004171500_vybe_discovery_keyset_pagination_20261004.sql`
- `20261004174500_vybe_atomic_like_match.sql`
- `20261004183000_vybe_notification_pipeline_scaling.sql`
- `20261004185000_vybe_notification_pipeline_indexes.sql`

These files must be reconciled deliberately before relying on `supabase db push` as the sole production deployment path.
