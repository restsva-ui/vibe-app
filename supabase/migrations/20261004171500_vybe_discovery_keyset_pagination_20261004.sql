-- VYBE 0.9.40 — scalable Discovery with backend-only keyset pagination.

create unique index if not exists intents_user_id_key
  on public.intents(user_id);

create index if not exists intents_intent_expires_user_idx
  on public.intents(intent, expires_at desc, user_id);

create or replace function public.vybe_discover_page(
  p_user_id uuid,
  p_min_age integer,
  p_max_age integer,
  p_city text,
  p_intent text,
  p_online_only boolean,
  p_verified_only boolean,
  p_limit integer,
  p_snapshot_at timestamptz,
  p_after_spotlight integer,
  p_after_spotlight_until timestamptz,
  p_after_intent_match integer,
  p_after_online integer,
  p_after_verified integer,
  p_after_user_id uuid
)
returns table (
  user_id uuid,
  name text,
  age integer,
  city text,
  bio text,
  photo_url text,
  verified boolean,
  online boolean,
  intent text,
  intent_match boolean,
  expires_at timestamptz,
  spotlight_until timestamptz,
  spotlight_active boolean,
  already_matched boolean,
  rank_spotlight integer,
  rank_spotlight_until timestamptz,
  rank_intent_match integer,
  rank_online integer,
  rank_verified integer,
  rank_user_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  with own_intent as (
    select oi.intent
    from public.intents oi
    where oi.user_id = p_user_id
      and oi.expires_at > p_snapshot_at
    limit 1
  ),
  ranked as (
    select
      p.user_id,
      p.name,
      p.age,
      p.city,
      p.bio,
      p.photo_url,
      (p.verified is true) as verified,
      (u.last_seen is not null and u.last_seen >= now() - interval '3 minutes') as online,
      i.intent,
      exists(select 1 from own_intent oi where oi.intent = i.intent) as intent_match,
      i.expires_at,
      case when e.spotlight_until > now() then e.spotlight_until else null end as spotlight_until,
      (e.spotlight_until > now()) as spotlight_active,
      false as already_matched,
      case when e.spotlight_until > p_snapshot_at then 1 else 0 end as rank_spotlight,
      case
        when e.spotlight_until > p_snapshot_at then e.spotlight_until
        else '1970-01-01T00:00:00Z'::timestamptz
      end as rank_spotlight_until,
      case when exists(select 1 from own_intent oi where oi.intent = i.intent) then 1 else 0 end as rank_intent_match,
      case
        when u.last_seen is not null and u.last_seen >= p_snapshot_at - interval '3 minutes' then 1
        else 0
      end as rank_online,
      case when p.verified is true then 1 else 0 end as rank_verified,
      p.user_id as rank_user_id
    from public.intents i
    join public.profiles p on p.user_id = i.user_id
    join public.users u on u.id = i.user_id
    left join public.user_entitlements e on e.user_id = i.user_id
    where i.expires_at > now()
      and i.user_id <> p_user_id
      and u.account_status is distinct from 'restricted'
      and p.age between p_min_age and p_max_age
      and (p_intent is null or p_intent = '' or i.intent = p_intent)
      and (
        coalesce(p_city,'') = ''
        or lower(coalesce(p.city,'')) like '%' || lower(p_city) || '%'
      )
      and (not p_verified_only or p.verified is true)
      and (
        not p_online_only
        or (u.last_seen is not null and u.last_seen >= now() - interval '3 minutes')
      )
      and not exists (
        select 1 from public.blocks bl
        where (bl.blocker_id = p_user_id and bl.blocked_id = i.user_id)
           or (bl.blocker_id = i.user_id and bl.blocked_id = p_user_id)
      )
      and not exists (
        select 1 from public.likes l
        where l.from_user_id = p_user_id
          and l.to_user_id = i.user_id
      )
      and not exists (
        select 1 from public.matches m
        where (m.user_a_id = p_user_id and m.user_b_id = i.user_id)
           or (m.user_a_id = i.user_id and m.user_b_id = p_user_id)
      )
      and not exists (
        select 1 from public.discovery_passes dp
        where dp.user_id = p_user_id
          and dp.target_user_id = i.user_id
          and dp.target_intent_expires_at > now()
      )
  )
  select
    r.user_id,
    r.name,
    r.age,
    r.city,
    r.bio,
    r.photo_url,
    r.verified,
    r.online,
    r.intent,
    r.intent_match,
    r.expires_at,
    r.spotlight_until,
    r.spotlight_active,
    r.already_matched,
    r.rank_spotlight,
    r.rank_spotlight_until,
    r.rank_intent_match,
    r.rank_online,
    r.rank_verified,
    r.rank_user_id
  from ranked r
  where p_after_user_id is null
     or (
       r.rank_spotlight,
       r.rank_spotlight_until,
       r.rank_intent_match,
       r.rank_online,
       r.rank_verified,
       r.rank_user_id
     ) < (
       coalesce(p_after_spotlight,0),
       coalesce(p_after_spotlight_until,'1970-01-01T00:00:00Z'::timestamptz),
       coalesce(p_after_intent_match,0),
       coalesce(p_after_online,0),
       coalesce(p_after_verified,0),
       p_after_user_id
     )
  order by
    r.rank_spotlight desc,
    r.rank_spotlight_until desc,
    r.rank_intent_match desc,
    r.rank_online desc,
    r.rank_verified desc,
    r.rank_user_id desc
  limit least(greatest(coalesce(p_limit,20),1),101);
$$;

revoke all on function public.vybe_discover_page(
  uuid,integer,integer,text,text,boolean,boolean,integer,timestamptz,
  integer,timestamptz,integer,integer,integer,uuid
) from public, anon, authenticated;

grant execute on function public.vybe_discover_page(
  uuid,integer,integer,text,text,boolean,boolean,integer,timestamptz,
  integer,timestamptz,integer,integer,integer,uuid
) to service_role;
