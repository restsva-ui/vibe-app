-- Interests and manually selected, coarse map areas. Existing profiles remain off-map.
alter table public.profiles
  add column interests text[] not null default '{}',
  add column map_enabled boolean not null default false,
  add column map_lat numeric(5,2),
  add column map_lng numeric(6,2),
  add constraint profiles_interests_valid check (
    cardinality(interests) <= 8 and interests <@ array['travel','music','cinema','gaming','books','sport','outdoors','coffee','food','cooking','art','tech','languages','pets','dancing','photography']::text[]
  ),
  add constraint profiles_map_area_valid check (
    (not map_enabled and map_lat is null and map_lng is null)
    or (map_enabled and map_lat is not null and map_lng is not null
      and map_lat between -85 and 85 and map_lng between -180 and 180
      and mod(map_lat * 20,1) = 0 and mod(map_lng * 20,1) = 0)
  );

create index profiles_interests_gin on public.profiles using gin(interests);
create index profiles_map_area_idx on public.profiles(map_lat,map_lng) where map_enabled;

create or replace function public.vybe_discover_interests_page(
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
  p_after_user_id uuid,
  p_interests text[],
  p_common_only boolean,
  p_map_only boolean,
  p_south double precision,
  p_north double precision,
  p_west double precision,
  p_east double precision,
  p_after_common_count integer
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
  interests text[],
  common_interests text[],
  map_lat double precision,
  map_lng double precision,
  expires_at timestamptz,
  spotlight_until timestamptz,
  spotlight_active boolean,
  already_matched boolean,
  rank_spotlight integer,
  rank_spotlight_until timestamptz,
  rank_intent_match integer,
  rank_common_count integer,
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
  own_profile as (select interests from public.profiles where user_id = p_user_id),
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
      p.interests,
      shared.interests as common_interests,
      case when p.map_enabled then p.map_lat::double precision else null end as map_lat,
      case when p.map_enabled then p.map_lng::double precision else null end as map_lng,
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
      cardinality(shared.interests) as rank_common_count,
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
    cross join lateral (
      select array(select tag from unnest(p.interests) as t(tag)
        where tag = any(coalesce((select op.interests from own_profile op),'{}'::text[]))
        order by tag) as interests
    ) shared
    where i.expires_at > now()
      and i.intent in ('Поговорити','Флірт','Дружба','Голос','Зустріч')
      and (coalesce(cardinality(p_interests),0) = 0 or p.interests && p_interests)
      and (not p_common_only or p.interests && coalesce((select op.interests from own_profile op),'{}'::text[]))
      and (not p_map_only or (p.map_enabled
        and p.map_lat between p_south::numeric and p_north::numeric
        and p.map_lng between p_west::numeric and p_east::numeric))
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
    r.interests,
    r.common_interests,
    r.map_lat,
    r.map_lng,
    r.expires_at,
    r.spotlight_until,
    r.spotlight_active,
    r.already_matched,
    r.rank_spotlight,
    r.rank_spotlight_until,
    r.rank_intent_match,
    r.rank_common_count,
    r.rank_online,
    r.rank_verified,
    r.rank_user_id
  from ranked r
  where p_after_user_id is null
     or (
       r.rank_spotlight,
       r.rank_spotlight_until,
       r.rank_intent_match,
       r.rank_common_count,
       r.rank_online,
       r.rank_verified,
       r.rank_user_id
     ) < (
       coalesce(p_after_spotlight,0),
       coalesce(p_after_spotlight_until,'1970-01-01T00:00:00Z'::timestamptz),
       coalesce(p_after_intent_match,0),
       coalesce(p_after_common_count,0),
       coalesce(p_after_online,0),
       coalesce(p_after_verified,0),
       p_after_user_id
     )
  order by
    r.rank_spotlight desc,
    r.rank_spotlight_until desc,
    r.rank_intent_match desc,
    r.rank_common_count desc,
    r.rank_online desc,
    r.rank_verified desc,
    r.rank_user_id desc
  limit least(greatest(coalesce(p_limit,20),1),101);
$$;

revoke all on function public.vybe_discover_interests_page(
  uuid,integer,integer,text,text,boolean,boolean,integer,timestamptz,
  integer,timestamptz,integer,integer,integer,uuid,
  text[],boolean,boolean,double precision,double precision,double precision,double precision,integer
) from public, anon, authenticated;

grant execute on function public.vybe_discover_interests_page(
  uuid,integer,integer,text,text,boolean,boolean,integer,timestamptz,
  integer,timestamptz,integer,integer,integer,uuid,
  text[],boolean,boolean,double precision,double precision,double precision,double precision,integer
) to service_role;
