-- VYBE matches endpoint optimization: one backend-only RPC instead of N+1 REST queries.

create or replace function public.vybe_matches_for_user(p_user_id uuid)
returns table (
  match_id uuid,
  realtime_topic uuid,
  created_at timestamptz,
  user_id uuid,
  profile jsonb,
  unread_count bigint,
  last_message text,
  last_message_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select
      m.id as match_id,
      m.realtime_topic,
      m.created_at,
      case when m.user_a_id = p_user_id then m.user_b_id else m.user_a_id end as other_id
    from public.matches m
    where (m.user_a_id = p_user_id or m.user_b_id = p_user_id)
      and not exists (
        select 1
        from public.blocks bl
        where (bl.blocker_id = p_user_id and bl.blocked_id = case when m.user_a_id = p_user_id then m.user_b_id else m.user_a_id end)
           or (bl.blocked_id = p_user_id and bl.blocker_id = case when m.user_a_id = p_user_id then m.user_b_id else m.user_a_id end)
      )
    order by m.created_at desc
    limit 100
  ),
  my_reads as (
    select r.match_id, r.last_read_at
    from public.match_reads r
    join base b on b.match_id = r.match_id
    where r.user_id = p_user_id
  ),
  latest as (
    select distinct on (msg.match_id)
      msg.match_id,
      msg.body,
      msg.created_at
    from public.messages msg
    join base b on b.match_id = msg.match_id
    order by msg.match_id, msg.created_at desc
  ),
  unread as (
    select msg.match_id, count(*)::bigint as unread_count
    from public.messages msg
    join base b on b.match_id = msg.match_id
    left join my_reads r on r.match_id = msg.match_id
    where msg.sender_id <> p_user_id
      and msg.created_at > coalesce(r.last_read_at, '1970-01-01T00:00:00Z'::timestamptz)
    group by msg.match_id
  )
  select
    b.match_id,
    b.realtime_topic,
    b.created_at,
    b.other_id as user_id,
    jsonb_strip_nulls(jsonb_build_object(
      'user_id', p.user_id,
      'name', p.name,
      'age', p.age,
      'city', p.city,
      'bio', p.bio,
      'photo_url', p.photo_url,
      'verified', p.verified
    )) || jsonb_build_object(
      'online', (u.last_seen is not null and u.last_seen >= now() - interval '3 minutes')
    ) as profile,
    coalesce(ur.unread_count, 0)::bigint as unread_count,
    l.body as last_message,
    l.created_at as last_message_at
  from base b
  join public.users u
    on u.id = b.other_id
   and u.account_status is distinct from 'restricted'
  left join public.profiles p on p.user_id = b.other_id
  left join latest l on l.match_id = b.match_id
  left join unread ur on ur.match_id = b.match_id
  order by b.created_at desc;
$$;

revoke all on function public.vybe_matches_for_user(uuid) from public, anon, authenticated;
grant execute on function public.vybe_matches_for_user(uuid) to service_role;
