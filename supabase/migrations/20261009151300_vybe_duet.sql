-- Telegram custom authentication: raw answers and this RPC are service-role only.
create table public.vybe_duets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  round_version smallint not null default 1 check (round_version = 1),
  joined_a_at timestamptz,
  joined_b_at timestamptz,
  created_at timestamptz not null default now()
);
create index vybe_duets_created_by_idx on public.vybe_duets(created_by);
create table public.vybe_duet_answers (
  duet_id uuid not null references public.vybe_duets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  question_index smallint not null check (question_index between 0 and 2),
  choice smallint not null check (choice between 0 and 1),
  guess smallint not null check (guess between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (duet_id, user_id, question_index)
);
create index vybe_duet_answers_user_idx on public.vybe_duet_answers(user_id);
alter table public.vybe_duets enable row level security;
alter table public.vybe_duet_answers enable row level security;
revoke all on public.vybe_duets, public.vybe_duet_answers from public, anon, authenticated;
grant select, insert, update, delete on public.vybe_duets, public.vybe_duet_answers to service_role;
comment on table public.vybe_duet_answers is 'Private duet answers. Returned to both participants only after both finish. Cascades with match/account deletion.';

create function public.vybe_duet(p_user uuid, p_action text, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_match_id uuid;
  v_match public.matches;
  v_duet public.vybe_duets;
  v_existing public.vybe_duet_answers;
  v_peer uuid;
  v_is_a boolean;
  v_joined boolean;
  v_my_count integer;
  v_peer_count integer;
  v_index integer;
  v_choice integer;
  v_guess integer;
  v_changed boolean := false;
  v_created boolean := false;
  v_my_answers jsonb;
  v_results jsonb := '[]'::jsonb;
  v_same integer := 0;
  v_guessed integer := 0;
  v_topic uuid;
  -- Version 1 is fixed: saved choices must retain the same meaning after releases.
  v_questions constant jsonb := '[
    {"title":{"uk":"Ідеальний вечір — це…","en":"Your ideal evening is…"},"options":[{"uk":"Затишок і розмова","en":"A cosy conversation"},{"uk":"Спонтанна пригода","en":"A spontaneous adventure"}],"follow_up":{"uk":"Який вечір ти хотів/-ла б повторити?","en":"Which evening would you love to relive?"}},
    {"title":{"uk":"Коли хочеться познайомитися ближче…","en":"When you want to get to know someone…"},"options":[{"uk":"Спочатку листування","en":"Start with messages"},{"uk":"Краще почути голос","en":"I would rather hear their voice"}],"follow_up":{"uk":"Що допомагає тобі відчути, що з людиною легко?","en":"What makes you feel at ease with someone?"}},
    {"title":{"uk":"Нове місце: який твій план?","en":"A new place: what is your plan?"},"options":[{"uk":"Знайти цікаві місця заздалегідь","en":"Find interesting spots in advance"},{"uk":"Піти й подивитися, куди заведе","en":"Go and see where it takes me"}],"follow_up":{"uk":"Куди ти мрієш потрапити й чому?","en":"Where do you dream of going, and why?"}}
  ]'::jsonb;
begin
  if p_user is null or p_action is null or p_action not in ('get','start','join','answer')
    or coalesce(jsonb_typeof(p_input),'') <> 'object'
    or coalesce(p_input->>'match_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'INVALID_DUET_REQUEST' using errcode = '22023';
  end if;
  v_match_id := (p_input->>'match_id')::uuid;
  -- Serializes starts/answers for this match, including starts from both devices.
  select * into v_match from public.matches where id = v_match_id for update;
  v_peer := public.vybe_chat_peer(p_user,v_match_id);
  v_is_a := v_match.user_a_id = p_user;
  select * into v_duet from public.vybe_duets where match_id = v_match_id;

  if p_action = 'start' and v_duet.id is null then
    insert into public.vybe_duets(match_id,created_by,joined_a_at,joined_b_at)
    values(v_match_id,p_user,case when v_is_a then now() end,case when not v_is_a then now() end)
    returning * into v_duet;
    v_created := true;
    v_changed := true;
  end if;
  if v_duet.id is null then
    if p_action <> 'get' then raise exception 'DUET_NOT_STARTED' using errcode = '55000'; end if;
    return jsonb_build_object('ok',true,'state','not_started','my_progress',0,'peer_progress',0,'my_joined',false,'questions',v_questions,'my_answers','[]'::jsonb,'results','[]'::jsonb);
  end if;
  v_joined := case when v_is_a then v_duet.joined_a_at is not null else v_duet.joined_b_at is not null end;
  if p_action in ('join','start') and not v_joined then
    update public.vybe_duets set
      joined_a_at = case when v_is_a then now() else joined_a_at end,
      joined_b_at = case when not v_is_a then now() else joined_b_at end
    where id = v_duet.id returning * into v_duet;
    v_joined := true;
    v_changed := true;
  end if;
  select count(*) into v_my_count from public.vybe_duet_answers where duet_id = v_duet.id and user_id = p_user;
  if p_action = 'answer' then
    if not v_joined then raise exception 'DUET_JOIN_REQUIRED' using errcode = '55000'; end if;
    if coalesce(jsonb_typeof(p_input->'question_index'),'') <> 'number' or coalesce(p_input->>'question_index','') !~ '^[0-2]$'
      or coalesce(jsonb_typeof(p_input->'choice'),'') <> 'number' or coalesce(p_input->>'choice','') !~ '^[0-1]$'
      or coalesce(jsonb_typeof(p_input->'guess'),'') <> 'number' or coalesce(p_input->>'guess','') !~ '^[0-1]$' then
      raise exception 'INVALID_DUET_ANSWER' using errcode = '22023';
    end if;
    v_index := (p_input->>'question_index')::integer;
    v_choice := (p_input->>'choice')::integer;
    v_guess := (p_input->>'guess')::integer;
    select * into v_existing from public.vybe_duet_answers
    where duet_id = v_duet.id and user_id = p_user and question_index = v_index;
    if v_existing.duet_id is not null then
      if v_existing.choice <> v_choice or v_existing.guess <> v_guess then
        raise exception 'DUET_ANSWER_LOCKED' using errcode = '55000';
      end if;
    else
      if v_index <> v_my_count then raise exception 'INVALID_DUET_ANSWER' using errcode = '22023'; end if;
      insert into public.vybe_duet_answers(duet_id,user_id,question_index,choice,guess)
      values(v_duet.id,p_user,v_index,v_choice,v_guess);
      v_my_count := v_my_count + 1;
      v_changed := true;
    end if;
  end if;

  select count(*) into v_peer_count from public.vybe_duet_answers where duet_id = v_duet.id and user_id = v_peer;
  select coalesce(jsonb_agg(jsonb_build_object('question_index',question_index,'choice',choice,'guess',guess) order by question_index),'[]'::jsonb)
  into v_my_answers from public.vybe_duet_answers where duet_id = v_duet.id and user_id = p_user;
  if v_my_count = 3 and v_peer_count = 3 then
    select jsonb_agg(jsonb_build_object('question_index',a.question_index,'my_choice',a.choice,'my_guess',a.guess,'peer_choice',b.choice,'peer_guess',b.guess) order by a.question_index),
      count(*) filter(where a.choice = b.choice), count(*) filter(where a.guess = b.choice)
    into v_results,v_same,v_guessed
    from public.vybe_duet_answers a join public.vybe_duet_answers b on b.duet_id = a.duet_id and b.question_index = a.question_index
    where a.duet_id = v_duet.id and a.user_id = p_user and b.user_id = v_peer;
  end if;
  if v_changed then
    for v_topic in select realtime_topic from public.users where id in (p_user,v_peer) loop
      -- No answers, guesses or profile data travel over public Broadcast topics.
      perform realtime.send(jsonb_build_object('match_id',v_match_id),'duet_changed','vybe:user:'||v_topic::text,false);
    end loop;
  end if;
  return jsonb_build_object('ok',true,'duet_id',v_duet.id,'created',v_created,'my_joined',v_joined,
    'state',case when not v_joined then 'invited' when v_my_count = 3 and v_peer_count = 3 then 'completed' when v_my_count = 3 then 'waiting' else 'playing' end,
    'my_progress',v_my_count,'peer_progress',v_peer_count,'questions',v_questions,'my_answers',v_my_answers,
    'results',v_results,'same_answers',v_same,'guessed_correct',v_guessed);
end $$;
revoke execute on function public.vybe_duet(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.vybe_duet(uuid,text,jsonb) to service_role;
