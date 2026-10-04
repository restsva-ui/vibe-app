-- VYBE server-side anti-abuse rate limiter.
-- Fixed windows are atomically enforced per authenticated user/action.
-- The private counter table is not exposed to anon/authenticated roles.

create table if not exists private.vybe_rate_limits (
  user_id uuid not null references public.users(id) on delete cascade,
  bucket_key text not null check (char_length(bucket_key) between 1 and 80),
  window_started_at timestamptz not null default now(),
  hits integer not null default 0 check (hits >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, bucket_key)
);

revoke all on table private.vybe_rate_limits from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.vybe_rate_limits to service_role;

create or replace function public.vybe_take_rate_limit(
  p_user_id uuid,
  p_bucket_key text,
  p_window_seconds integer,
  p_max_hits integer,
  p_cost integer default 1
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_started timestamptz;
  v_hits integer;
  v_elapsed numeric;
  v_retry integer;
begin
  if p_user_id is null
     or p_bucket_key is null
     or char_length(p_bucket_key) < 1
     or char_length(p_bucket_key) > 80
     or p_window_seconds < 1
     or p_window_seconds > 86400
     or p_max_hits < 1
     or p_max_hits > 100000
     or p_cost < 1
     or p_cost > p_max_hits
  then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_bucket_key || ':vybe-rate', 0)
  );

  select window_started_at, hits
  into v_started, v_hits
  from private.vybe_rate_limits
  where user_id = p_user_id
    and bucket_key = p_bucket_key;

  if v_started is null then
    insert into private.vybe_rate_limits(
      user_id,bucket_key,window_started_at,hits,updated_at
    )
    values(p_user_id,p_bucket_key,v_now,p_cost,v_now);

    return jsonb_build_object(
      'allowed',true,
      'limit',p_max_hits,
      'remaining',greatest(p_max_hits-p_cost,0),
      'retry_after_seconds',0
    );
  end if;

  v_elapsed := extract(epoch from (v_now - v_started));

  if v_elapsed >= p_window_seconds then
    update private.vybe_rate_limits
    set window_started_at=v_now,
        hits=p_cost,
        updated_at=v_now
    where user_id=p_user_id
      and bucket_key=p_bucket_key;

    return jsonb_build_object(
      'allowed',true,
      'limit',p_max_hits,
      'remaining',greatest(p_max_hits-p_cost,0),
      'retry_after_seconds',0
    );
  end if;

  if v_hits + p_cost > p_max_hits then
    v_retry := greatest(1,ceil(p_window_seconds-v_elapsed)::integer);

    update private.vybe_rate_limits
    set updated_at=v_now
    where user_id=p_user_id
      and bucket_key=p_bucket_key;

    return jsonb_build_object(
      'allowed',false,
      'limit',p_max_hits,
      'remaining',0,
      'retry_after_seconds',v_retry
    );
  end if;

  update private.vybe_rate_limits
  set hits=v_hits+p_cost,
      updated_at=v_now
  where user_id=p_user_id
    and bucket_key=p_bucket_key;

  return jsonb_build_object(
    'allowed',true,
    'limit',p_max_hits,
    'remaining',greatest(p_max_hits-(v_hits+p_cost),0),
    'retry_after_seconds',0
  );
end;
$$;

revoke all on function public.vybe_take_rate_limit(uuid,text,integer,integer,integer)
  from public, anon, authenticated;
grant execute on function public.vybe_take_rate_limit(uuid,text,integer,integer,integer)
  to service_role;

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
  v_rate_limits bigint := 0;
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

  delete from private.vybe_rate_limits
  where updated_at < now() - interval '7 days';
  get diagnostics v_rate_limits = row_count;

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
    'stale_rate_limits_deleted', v_rate_limits,
    'cron_run_history_deleted', v_run_history,
    'ran_at', now()
  );
end;
$$;

revoke all on function private.vybe_cleanup_retention() from public, anon, authenticated;
grant execute on function private.vybe_cleanup_retention() to postgres;
