-- Filter before the result limit; preserve legacy cached clients' day presets.
create function public.vybe_plan_list(p_user uuid,p_input jsonb default '{}'::jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_category text; v_day text; v_bounds jsonb; v_from timestamptz; v_before timestamptz; v_rows jsonb;
begin
  if p_user is null or not exists(select 1 from public.users u where u.id=p_user and u.account_status='active') then
    raise exception 'PLAN_UNAVAILABLE' using errcode='42501';
  end if;
  if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
  v_category:=coalesce(p_input->>'category',''); v_day:=coalesce(p_input->>'day','all'); v_bounds:=p_input->'bounds';
  if v_category<>'' and v_category not in ('pizza','pub','walk','celebration','party','outdoors','other') or v_day not in ('all','24h','week') then
    raise exception 'INVALID_PLAN' using errcode='22023';
  end if;
  if v_bounds is not null then
    if jsonb_typeof(v_bounds) is distinct from 'object'
      or jsonb_typeof(v_bounds->'south') is distinct from 'number' or jsonb_typeof(v_bounds->'north') is distinct from 'number'
      or jsonb_typeof(v_bounds->'west') is distinct from 'number' or jsonb_typeof(v_bounds->'east') is distinct from 'number' then
      raise exception 'INVALID_PLAN' using errcode='22023';
    end if;
    if (v_bounds->>'south')::numeric < -85 or (v_bounds->>'north')::numeric > 85
      or (v_bounds->>'south')::numeric >= (v_bounds->>'north')::numeric
      or (v_bounds->>'west')::numeric not between -180 and 180 or (v_bounds->>'east')::numeric not between -180 and 180 then
      raise exception 'INVALID_PLAN' using errcode='22023';
    end if;
  end if;
  if p_input ? 'starts_from' or p_input ? 'starts_before' then
    if jsonb_typeof(p_input->'starts_from') is distinct from 'string' or jsonb_typeof(p_input->'starts_before') is distinct from 'string'
      or (p_input->>'starts_from') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
      or (p_input->>'starts_before') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$' or v_day<>'all' then
      raise exception 'INVALID_PLAN' using errcode='22023';
    end if;
    begin v_from:=(p_input->>'starts_from')::timestamptz; v_before:=(p_input->>'starts_before')::timestamptz;
    exception when others then raise exception 'INVALID_PLAN' using errcode='22023'; end;
    if v_from>=v_before or v_before-v_from>interval '26 hours'
      or to_char(v_from at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>p_input->>'starts_from'
      or to_char(v_before at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>p_input->>'starts_before' then
      raise exception 'INVALID_PLAN' using errcode='22023';
    end if;
  end if;
  select coalesce(jsonb_agg(q.card order by q.starts_at,q.id),'[]'::jsonb) into v_rows from (
    select public.vybe_plan_card(p.id,p_user) card,p.starts_at,p.id from public.vybe_plans p
    where p.status='active' and p.ends_at>now() and public.vybe_plan_visible(p_user,p.owner_id)
      and (v_category='' or p.category=v_category)
      and (v_day='all' or p.starts_at<=now()+case when v_day='24h' then interval '24 hours' else interval '7 days' end)
      and (v_from is null or (p.starts_at>=v_from and p.starts_at<v_before))
      and (v_bounds is null or (p.map_lat between (v_bounds->>'south')::numeric and (v_bounds->>'north')::numeric
        and (case when (v_bounds->>'west')::numeric<=(v_bounds->>'east')::numeric then p.map_lng between (v_bounds->>'west')::numeric and (v_bounds->>'east')::numeric else p.map_lng>=(v_bounds->>'west')::numeric or p.map_lng<=(v_bounds->>'east')::numeric end)))
    order by p.starts_at,p.id limit 100
  ) q;
  return jsonb_build_object('ok',true,'plans',v_rows,'limit',100);
end $$;
revoke all on function public.vybe_plan_list(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.vybe_plan_list(uuid,jsonb) to service_role;
