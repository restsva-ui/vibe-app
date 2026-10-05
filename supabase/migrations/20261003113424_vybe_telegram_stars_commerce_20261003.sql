-- VYBE Telegram Stars commerce foundation.
-- Digital goods are purchased with Telegram Stars (XTR) and granted only after successful_payment.

create table if not exists public.star_products (
  product_key text primary key,
  title_uk text not null,
  title_en text not null,
  description_uk text not null,
  description_en text not null,
  stars integer not null check (stars > 0),
  grant_type text not null check (grant_type in ('supervybe','spotlight','vybe_plus_days')),
  grant_amount integer not null check (grant_amount > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.star_products (
  product_key,title_uk,title_en,description_uk,description_en,stars,grant_type,grant_amount,active,sort_order
) values
  ('supervybe_5','5 SuperVYBE','5 SuperVYBE','П’ять посилених вайбів для анкет, які справді зачепили.','Five boosted vibes for profiles that really stand out.',50,'supervybe',5,true,10),
  ('spotlight_3','3 Spotlight','3 Spotlight','Три підняття анкети у видачі. Кожне активується на 30 хвилин.','Three profile boosts in discovery. Each activation lasts 30 minutes.',60,'spotlight',3,true,20),
  ('vybe_plus_7d','VYBE+ • 7 днів','VYBE+ • 7 days','Сім днів VYBE+; термін додається до вже активного VYBE+.','Seven days of VYBE+; time is added to any active VYBE+ period.',120,'vybe_plus_days',7,true,30)
on conflict (product_key) do update set
  title_uk=excluded.title_uk,
  title_en=excluded.title_en,
  description_uk=excluded.description_uk,
  description_en=excluded.description_en,
  stars=excluded.stars,
  grant_type=excluded.grant_type,
  grant_amount=excluded.grant_amount,
  active=excluded.active,
  sort_order=excluded.sort_order,
  updated_at=now();

create table if not exists public.star_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_id bigint not null,
  product_key text not null references public.star_products(product_key),
  invoice_payload text not null unique,
  currency text not null default 'XTR' check (currency = 'XTR'),
  total_amount integer not null check (total_amount > 0),
  grant_type text not null check (grant_type in ('supervybe','spotlight','vybe_plus_days')),
  grant_amount integer not null check (grant_amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','refunded')),
  telegram_payment_charge_id text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  paid_at timestamptz,
  refunded_at timestamptz
);

create index if not exists star_orders_user_created_idx on public.star_orders(user_id,created_at desc);
create index if not exists star_orders_pending_expiry_idx on public.star_orders(expires_at) where status='pending';

create table if not exists public.paid_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_order_id uuid not null unique references public.star_orders(id) on delete cascade,
  reward_type text not null check (reward_type in ('supervybe','spotlight')),
  reward_amount integer not null check (reward_amount > 0),
  granted_at timestamptz not null default now()
);

create index if not exists paid_rewards_user_type_idx on public.paid_rewards(user_id,reward_type,granted_at desc);

alter table public.star_products enable row level security;
alter table public.star_orders enable row level security;
alter table public.paid_rewards enable row level security;
revoke all on table public.star_products, public.star_orders, public.paid_rewards from anon, authenticated;
grant select, insert, update, delete on table public.star_products, public.star_orders, public.paid_rewards to service_role;

create or replace function public.apply_star_payment(
  p_payload text,p_telegram_id bigint,p_currency text,p_total_amount integer,p_charge_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.star_orders%rowtype;
  v_until timestamptz;
begin
  if coalesce(p_payload,'')='' or coalesce(p_charge_id,'')='' then raise exception 'INVALID_PAYMENT'; end if;

  select * into v_order from public.star_orders where invoice_payload=p_payload for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_order.telegram_id<>p_telegram_id
     or p_currency<>'XTR'
     or v_order.currency<>p_currency
     or v_order.total_amount<>p_total_amount then
    raise exception 'PAYMENT_MISMATCH';
  end if;

  if v_order.status='paid' then
    if v_order.telegram_payment_charge_id=p_charge_id then
      return jsonb_build_object('ok',true,'applied',false,'order_id',v_order.id,'product_key',v_order.product_key);
    end if;
    raise exception 'ORDER_ALREADY_PAID';
  end if;

  if v_order.status<>'pending' then raise exception 'ORDER_NOT_PAYABLE'; end if;

  if exists(select 1 from public.star_orders where telegram_payment_charge_id=p_charge_id and id<>v_order.id) then
    raise exception 'DUPLICATE_CHARGE';
  end if;

  update public.star_orders
  set status='paid',telegram_payment_charge_id=p_charge_id,paid_at=now()
  where id=v_order.id;

  if v_order.grant_type in ('supervybe','spotlight') then
    insert into public.paid_rewards(user_id,source_order_id,reward_type,reward_amount)
    values(v_order.user_id,v_order.id,v_order.grant_type,v_order.grant_amount)
    on conflict(source_order_id) do nothing;
  elsif v_order.grant_type='vybe_plus_days' then
    select vybe_plus_until into v_until
    from public.user_entitlements
    where user_id=v_order.user_id
    limit 1;

    v_until:=greatest(now(),coalesce(v_until,now()))+make_interval(days=>v_order.grant_amount);

    insert into public.user_entitlements(user_id,vybe_plus_until,updated_at)
    values(v_order.user_id,v_until,now())
    on conflict(user_id) do update
    set vybe_plus_until=excluded.vybe_plus_until,updated_at=now();
  end if;

  return jsonb_build_object(
    'ok',true,'applied',true,'order_id',v_order.id,'product_key',v_order.product_key,
    'grant_type',v_order.grant_type,'grant_amount',v_order.grant_amount
  );
end;
$$;

revoke all on function public.apply_star_payment(text,bigint,text,integer,text) from public,anon,authenticated;
grant execute on function public.apply_star_payment(text,bigint,text,integer,text) to service_role;

create or replace function public.use_spotlight(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned integer:=0;
  v_used integer:=0;
  v_current timestamptz;
  v_until timestamptz;
begin
  if p_user_id is null or not exists(select 1 from public.users where id=p_user_id) then raise exception 'USER_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':spotlight',0));

  select
    coalesce((select sum(reward_amount) from public.referral_rewards where user_id=p_user_id and reward_type='spotlight'),0)
    + coalesce((select sum(reward_amount) from public.paid_rewards where user_id=p_user_id and reward_type='spotlight'),0)
  into v_earned;

  select coalesce(sum(reward_amount),0)::integer into v_used
  from public.reward_uses where user_id=p_user_id and reward_type='spotlight';

  if v_earned-v_used<1 then raise exception 'NO_SPOTLIGHT'; end if;

  select spotlight_until into v_current from public.user_entitlements where user_id=p_user_id limit 1;
  v_until:=greatest(now(),coalesce(v_current,now()))+interval '30 minutes';

  insert into public.reward_uses(user_id,reward_type,reward_amount) values(p_user_id,'spotlight',1);

  insert into public.user_entitlements(user_id,spotlight_until,updated_at)
  values(p_user_id,v_until,now())
  on conflict(user_id) do update set spotlight_until=excluded.spotlight_until,updated_at=now();

  return jsonb_build_object('spotlight_until',v_until,'balance',v_earned-v_used-1);
end;
$$;

revoke all on function public.use_spotlight(uuid) from public,anon,authenticated;
grant execute on function public.use_spotlight(uuid) to service_role;

create or replace function public.use_supervybe_and_like(p_user_id uuid,p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned integer:=0;
  v_used integer:=0;
  v_reciprocal boolean:=false;
  v_match_id uuid;
  v_user_a uuid;
  v_user_b uuid;
begin
  if p_user_id is null or p_target_user_id is null or p_user_id=p_target_user_id then raise exception 'INVALID_TARGET'; end if;
  if not exists(select 1 from public.users where id=p_user_id) then raise exception 'USER_NOT_FOUND'; end if;
  if not exists(select 1 from public.users where id=p_target_user_id) then raise exception 'TARGET_NOT_FOUND'; end if;
  if exists(select 1 from public.blocks where (blocker_id=p_user_id and blocked_id=p_target_user_id) or (blocker_id=p_target_user_id and blocked_id=p_user_id)) then
    raise exception 'USER_BLOCKED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':supervybe',0));

  select
    coalesce((select sum(reward_amount) from public.referral_rewards where user_id=p_user_id and reward_type='supervybe'),0)
    + coalesce((select sum(reward_amount) from public.paid_rewards where user_id=p_user_id and reward_type='supervybe'),0)
  into v_earned;

  select coalesce(sum(reward_amount),0)::integer into v_used
  from public.reward_uses where user_id=p_user_id and reward_type='supervybe';

  if v_earned-v_used<1 then raise exception 'NO_SUPERVYBE'; end if;

  insert into public.likes(from_user_id,to_user_id,kind)
  values(p_user_id,p_target_user_id,'super')
  on conflict(from_user_id,to_user_id) do update set kind='super';

  insert into public.reward_uses(user_id,reward_type,reward_amount) values(p_user_id,'supervybe',1);

  select exists(select 1 from public.likes where from_user_id=p_target_user_id and to_user_id=p_user_id) into v_reciprocal;

  if v_reciprocal then
    if p_user_id<p_target_user_id then v_user_a:=p_user_id;v_user_b:=p_target_user_id;
    else v_user_a:=p_target_user_id;v_user_b:=p_user_id; end if;

    insert into public.matches(user_a_id,user_b_id)
    values(v_user_a,v_user_b)
    on conflict(user_a_id,user_b_id) do nothing;

    select id into v_match_id from public.matches where user_a_id=v_user_a and user_b_id=v_user_b limit 1;
  end if;

  return jsonb_build_object(
    'matched',v_reciprocal,
    'match',case when v_match_id is null then null else jsonb_build_object('id',v_match_id) end,
    'balance',v_earned-v_used-1
  );
end;
$$;

revoke all on function public.use_supervybe_and_like(uuid,uuid) from public,anon,authenticated;
grant execute on function public.use_supervybe_and_like(uuid,uuid) to service_role;
