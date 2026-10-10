-- Telegram-auth is the only entry point. No client table access or caller-supplied identity.
create table public.vybe_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  client_nonce uuid not null,
  request_hash text not null,
  category text not null check(category in ('pizza','pub','walk','celebration','party','outdoors','other')),
  title text not null check(length(btrim(title)) between 3 and 80),
  description text not null default '' check(length(description)<=500),
  city text not null check(length(btrim(city)) between 1 and 64),
  venue_label text not null check(length(btrim(venue_label)) between 2 and 80),
  visibility text not null check(visibility in ('public','private')),
  map_lat numeric not null check(map_lat between -85 and 85),
  map_lng numeric not null check(map_lng between -180 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'),
  capacity integer not null check(capacity between 2 and 20),
  status text not null default 'active' check(status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  unique(owner_id,client_nonce)
);
create index vybe_plans_active_time on public.vybe_plans(ends_at,starts_at) where status='active';
create index vybe_plans_owner on public.vybe_plans(owner_id,created_at desc);
-- The precise address is never stored in a public card or broadcast.
create table public.vybe_plan_locations (
  plan_id uuid primary key references public.vybe_plans(id) on delete cascade,
  meeting_details text not null check(length(btrim(meeting_details)) between 2 and 300)
);
create table public.vybe_plan_applications (
  plan_id uuid not null references public.vybe_plans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check(status in ('pending','approved','rejected','left')),
  note text not null default '' check(length(note)<=200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(plan_id,user_id)
);
create index vybe_plan_applications_user on public.vybe_plan_applications(user_id,updated_at desc);
create table public.vybe_plan_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.vybe_plans(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  client_nonce uuid not null,
  body text not null check(length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique(plan_id,sender_id,client_nonce)
);
create index vybe_plan_messages_time on public.vybe_plan_messages(plan_id,created_at desc,id);
alter table public.vybe_plans enable row level security;
alter table public.vybe_plan_locations enable row level security;
alter table public.vybe_plan_applications enable row level security;
alter table public.vybe_plan_messages enable row level security;
revoke all on public.vybe_plans,public.vybe_plan_locations,public.vybe_plan_applications,public.vybe_plan_messages from public,anon,authenticated;
grant select,insert,update,delete on public.vybe_plans,public.vybe_plan_locations,public.vybe_plan_applications,public.vybe_plan_messages to service_role;

