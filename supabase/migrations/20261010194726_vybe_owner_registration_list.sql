-- Owner-only registration list. No new public tables, policies or client grants.
create index if not exists users_registration_order_idx
  on public.users (created_at desc nulls last, id desc);

create or replace function public.vybe_owner_registrations(
  p_actor uuid,
  p_range text default 'all',
  p_before_time timestamptz default null,
  p_before_id uuid default null,
  p_snapshot timestamptz default null,
  p_limit integer default 25
) returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_snapshot timestamptz := least(coalesce(p_snapshot, now()), now());
  v_since timestamptz;
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 50));
  v_total bigint;
  v_rows jsonb := '[]'::jsonb;
  v_last record;
  v_row record;
  v_count integer := 0;
  v_more boolean := false;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = p_actor and a.role = 'owner') then
    raise exception 'OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_range is null or p_range not in ('all', 'today', 'week') then
    raise exception 'INVALID_REGISTRATION_FILTER' using errcode = '22023';
  end if;
  if (p_before_id is null and p_before_time is not null)
     or (p_before_id is not null and p_snapshot is null)
     or (p_before_time > v_snapshot) then
    raise exception 'INVALID_REGISTRATION_CURSOR' using errcode = '22023';
  end if;
  v_since := case p_range
    when 'today' then date_trunc('day', v_snapshot at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv'
    when 'week' then v_snapshot - interval '7 days'
    else null end;

  select count(*) into v_total from public.users u
  where (u.created_at <= v_snapshot or u.created_at is null)
    and (v_since is null or u.created_at >= v_since);

  for v_row in
    select u.id, coalesce(nullif(btrim(p.name), ''), nullif(btrim(u.first_name), ''), 'VYBE') as display_name,
      nullif(btrim(u.username), '') as username, u.created_at as registered_at,
      (p.user_id is not null) as has_profile, p.created_at as profile_created_at, u.last_seen
    from public.users u left join public.profiles p on p.user_id = u.id
    where (u.created_at <= v_snapshot or u.created_at is null)
      and (v_since is null or u.created_at >= v_since)
      and (p_before_id is null
        or (p_before_time is not null and ((u.created_at, u.id) < (p_before_time, p_before_id) or u.created_at is null))
        or (p_before_time is null and u.created_at is null and u.id < p_before_id))
    order by u.created_at desc nulls last, u.id desc
    limit v_limit + 1
  loop
    if v_count >= v_limit then v_more := true; exit; end if;
    v_rows := v_rows || jsonb_build_array(to_jsonb(v_row));
    v_last := v_row;
    v_count := v_count + 1;
  end loop;

  if v_more then
    return jsonb_build_object('users', v_rows, 'total', v_total, 'range', p_range,
      'snapshot_at', v_snapshot, 'has_more', true, 'next_cursor',
      jsonb_build_object('id', v_last.id, 'registered_at', v_last.registered_at, 'snapshot_at', v_snapshot));
  end if;
  return jsonb_build_object('users', v_rows, 'total', v_total, 'range', p_range,
    'snapshot_at', v_snapshot, 'has_more', false, 'next_cursor', null);
end;
$$;

revoke all on function public.vybe_owner_registrations(uuid,text,timestamptz,uuid,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.vybe_owner_registrations(uuid,text,timestamptz,uuid,timestamptz,integer) to service_role;
comment on function public.vybe_owner_registrations(uuid,text,timestamptz,uuid,timestamptz,integer)
  is 'Service-only, owner-authorized registration list with Kyiv filters and stable keyset pagination.';
