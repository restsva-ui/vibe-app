-- VYBE — notification pipeline scaling and delivery race hardening.
-- Adds FK-covering indexes, backend-only read RPCs, and an atomic delivery claim.

drop index if exists public.notification_events_actor_user_idx;
drop index if exists public.notification_events_match_id_idx;
drop index if exists public.notification_deliveries_actor_user_idx;
drop index if exists public.notification_deliveries_match_id_idx;

create index notification_events_actor_user_idx
  on public.notification_events(actor_user_id);

create index notification_events_match_id_idx
  on public.notification_events(match_id);

create index notification_deliveries_actor_user_idx
  on public.notification_deliveries(actor_user_id);

create index notification_deliveries_match_id_idx
  on public.notification_deliveries(match_id);

create or replace function public.vybe_notification_unread_count(p_user_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::bigint
  from public.notification_events e
  where e.recipient_user_id = p_user_id
    and e.seen_at is null;
$$;

revoke all on function public.vybe_notification_unread_count(uuid) from public, anon, authenticated;
grant execute on function public.vybe_notification_unread_count(uuid) to service_role;

create or replace function public.vybe_notifications_for_user(
  p_user_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  event_type text,
  match_id uuid,
  payload jsonb,
  created_at timestamptz,
  seen_at timestamptz,
  actor jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.id,
    e.event_type,
    coalesce(e.match_id, resolved_match.id) as match_id,
    e.payload,
    e.created_at,
    e.seen_at,
    case
      when e.event_type = 'like' or e.actor_user_id is null then null
      when p.user_id is null then null
      else jsonb_strip_nulls(jsonb_build_object(
        'user_id', p.user_id,
        'name', p.name,
        'photo_url', p.photo_url,
        'verified', (p.verified is true)
      ))
    end as actor
  from public.notification_events e
  left join public.profiles p
    on p.user_id = e.actor_user_id
   and e.event_type <> 'like'
  left join lateral (
    select m.id
    from public.matches m
    where e.event_type = 'like'
      and e.actor_user_id is not null
      and (
        (m.user_a_id = p_user_id and m.user_b_id = e.actor_user_id)
        or
        (m.user_b_id = p_user_id and m.user_a_id = e.actor_user_id)
      )
    limit 1
  ) resolved_match on true
  where e.recipient_user_id = p_user_id
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit,100),1),100);
$$;

revoke all on function public.vybe_notifications_for_user(uuid,integer) from public, anon, authenticated;
grant execute on function public.vybe_notifications_for_user(uuid,integer) to service_role;

create or replace function public.vybe_mark_notifications_seen(
  p_user_id uuid,
  p_match_id uuid default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_seen_at timestamptz := now();
  v_marked bigint := 0;
begin
  update public.notification_events e
  set seen_at = v_seen_at
  where e.recipient_user_id = p_user_id
    and e.seen_at is null
    and (p_match_id is null or e.match_id = p_match_id);

  get diagnostics v_marked = row_count;

  return jsonb_build_object(
    'marked', v_marked,
    'seen_at', v_seen_at
  );
end;
$$;

revoke all on function public.vybe_mark_notifications_seen(uuid,uuid) from public, anon, authenticated;
grant execute on function public.vybe_mark_notifications_seen(uuid,uuid) to service_role;

create or replace function public.vybe_claim_notification_delivery(
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_match_id uuid,
  p_source_key text,
  p_cooldown_seconds integer default 0
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_delivery_id uuid;
  v_lock_key text;
  v_cooldown_seconds integer := least(greatest(coalesce(p_cooldown_seconds,0),0),3600);
begin
  if p_recipient_user_id is null then
    raise exception 'INVALID_RECIPIENT';
  end if;
  if p_event_type not in ('like','match','message') then
    raise exception 'INVALID_EVENT_TYPE';
  end if;

  v_lock_key := p_recipient_user_id::text || ':' || coalesce(p_match_id::text,'none') || ':' || p_event_type || ':notification';
  perform pg_advisory_xact_lock(hashtextextended(v_lock_key,0));

  if p_source_key is not null and exists (
    select 1
    from public.notification_deliveries d
    where d.source_key = p_source_key
  ) then
    return jsonb_build_object('claimed',false,'reason','duplicate');
  end if;

  if p_event_type = 'message'
     and p_match_id is not null
     and v_cooldown_seconds > 0
     and exists (
       select 1
       from public.notification_deliveries d
       where d.recipient_user_id = p_recipient_user_id
         and d.event_type = 'message'
         and d.match_id = p_match_id
         and d.created_at >= now() - (v_cooldown_seconds * interval '1 second')
     )
  then
    return jsonb_build_object('claimed',false,'reason','cooldown');
  end if;

  insert into public.notification_deliveries(
    recipient_user_id,
    actor_user_id,
    event_type,
    match_id,
    source_key,
    telegram_message_id
  )
  values(
    p_recipient_user_id,
    p_actor_user_id,
    p_event_type,
    p_match_id,
    p_source_key,
    null
  )
  on conflict(source_key) do nothing
  returning id into v_delivery_id;

  if v_delivery_id is null then
    return jsonb_build_object('claimed',false,'reason','duplicate');
  end if;

  return jsonb_build_object(
    'claimed',true,
    'delivery_id',v_delivery_id
  );
end;
$$;

revoke all on function public.vybe_claim_notification_delivery(uuid,uuid,text,uuid,text,integer)
  from public, anon, authenticated;
grant execute on function public.vybe_claim_notification_delivery(uuid,uuid,text,uuid,text,integer)
  to service_role;
