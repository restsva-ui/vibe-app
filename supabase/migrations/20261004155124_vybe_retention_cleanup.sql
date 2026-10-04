-- VYBE retention cleanup.
-- Keeps user chat history intact while pruning technical and expired records.

create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.vybe_cleanup_retention()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_deliveries bigint := 0;
  v_seen_events bigint := 0;
  v_unseen_events bigint := 0;
  v_intents bigint := 0;
  v_passes bigint := 0;
  v_run_history bigint := 0;
begin
  delete from public.notification_deliveries
  where created_at < now() - interval '30 days';
  get diagnostics v_deliveries = row_count;

  delete from public.notification_events
  where seen_at is not null
    and created_at < now() - interval '90 days';
  get diagnostics v_seen_events = row_count;

  delete from public.notification_events
  where seen_at is null
    and created_at < now() - interval '180 days';
  get diagnostics v_unseen_events = row_count;

  delete from public.intents
  where expires_at < now() - interval '24 hours';
  get diagnostics v_intents = row_count;

  delete from public.discovery_passes
  where target_intent_expires_at < now() - interval '7 days';
  get diagnostics v_passes = row_count;

  delete from cron.job_run_details
  where end_time is not null
    and end_time < now() - interval '14 days';
  get diagnostics v_run_history = row_count;

  return jsonb_build_object(
    'notification_deliveries_deleted', v_deliveries,
    'seen_notification_events_deleted', v_seen_events,
    'unseen_notification_events_deleted', v_unseen_events,
    'expired_intents_deleted', v_intents,
    'expired_discovery_passes_deleted', v_passes,
    'cron_run_history_deleted', v_run_history,
    'ran_at', now()
  );
end;
$$;

revoke all on function private.vybe_cleanup_retention() from public, anon, authenticated;
grant usage on schema private to postgres;
grant execute on function private.vybe_cleanup_retention() to postgres;

select cron.unschedule(jobid)
from cron.job
where jobname = 'vybe-cron-history-cleanup';

select cron.schedule(
  'vybe-retention-cleanup',
  '17 3 * * *',
  $$select private.vybe_cleanup_retention();$$
);
