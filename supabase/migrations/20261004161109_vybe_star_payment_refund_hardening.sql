-- VYBE Telegram Stars payment/refund hardening.
-- Makes payment application invoker-safe and refunds idempotent/recoverable via Telegram refunded_payment.

alter table public.star_orders
  add column if not exists refund_requested_at timestamptz;

alter table public.star_orders
  drop constraint if exists star_orders_status_check;

alter table public.star_orders
  add constraint star_orders_status_check
  check (status = any (array[
    'pending'::text,
    'paid'::text,
    'refunding'::text,
    'failed'::text,
    'expired'::text,
    'cancelled'::text,
    'refunded'::text
  ]));

create or replace function public.apply_star_payment(
  p_payload text,
  p_telegram_id bigint,
  p_currency text,
  p_total_amount integer,
  p_charge_id text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_order public.star_orders%rowtype;
  v_until timestamptz;
begin
  if coalesce(p_payload,'') = '' or coalesce(p_charge_id,'') = '' then
    raise exception 'INVALID_PAYMENT';
  end if;

  select *
    into v_order
  from public.star_orders
  where invoice_payload = p_payload
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_order.telegram_id <> p_telegram_id
     or p_currency <> 'XTR'
     or v_order.currency <> p_currency
     or v_order.total_amount <> p_total_amount then
    raise exception 'PAYMENT_MISMATCH';
  end if;

  if v_order.status = 'paid' then
    if v_order.telegram_payment_charge_id = p_charge_id then
      return jsonb_build_object(
        'ok',true,'applied',false,'order_id',v_order.id,
        'product_key',v_order.product_key,'grant_type',v_order.grant_type,
        'grant_amount',v_order.grant_amount,'status','paid'
      );
    end if;
    raise exception 'ORDER_ALREADY_PAID';
  end if;

  if v_order.status in ('refunding','refunded') then
    if v_order.telegram_payment_charge_id = p_charge_id then
      return jsonb_build_object(
        'ok',true,'applied',false,'order_id',v_order.id,
        'product_key',v_order.product_key,'grant_type',v_order.grant_type,
        'grant_amount',v_order.grant_amount,'status',v_order.status
      );
    end if;
    raise exception 'ORDER_ALREADY_PAID';
  end if;

  if v_order.status <> 'pending' then raise exception 'ORDER_NOT_PAYABLE'; end if;

  if exists (
    select 1 from public.star_orders
    where telegram_payment_charge_id = p_charge_id
      and id <> v_order.id
  ) then
    raise exception 'DUPLICATE_CHARGE';
  end if;

  update public.star_orders
  set status='paid',
      telegram_payment_charge_id=p_charge_id,
      paid_at=now()
  where id=v_order.id;

  if v_order.grant_type in ('supervybe','spotlight') then
    insert into public.paid_rewards(user_id,source_order_id,reward_type,reward_amount)
    values (v_order.user_id,v_order.id,v_order.grant_type,v_order.grant_amount)
    on conflict (source_order_id) do nothing;
  elsif v_order.grant_type = 'vybe_plus_days' then
    select vybe_plus_until into v_until
    from public.user_entitlements
    where user_id=v_order.user_id
    limit 1;

    v_until := greatest(now(),coalesce(v_until,now()))
      + make_interval(days => v_order.grant_amount);

    insert into public.user_entitlements(user_id,vybe_plus_until,updated_at)
    values(v_order.user_id,v_until,now())
    on conflict(user_id) do update
    set vybe_plus_until=excluded.vybe_plus_until,
        updated_at=now();
  elsif v_order.grant_type = 'test_refund' then
    null;
  end if;

  return jsonb_build_object(
    'ok',true,'applied',true,'order_id',v_order.id,
    'product_key',v_order.product_key,'grant_type',v_order.grant_type,
    'grant_amount',v_order.grant_amount,'status','paid'
  );
end;
$$;

revoke all on function public.apply_star_payment(text,bigint,text,integer,text)
  from public, anon, authenticated;
grant execute on function public.apply_star_payment(text,bigint,text,integer,text)
  to service_role;

create or replace function public.claim_star_refund(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_order public.star_orders%rowtype;
begin
  select *
    into v_order
  from public.star_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_order.status = 'refunded' then
    return jsonb_build_object(
      'ok',true,'claimed',false,'already_refunded',true,
      'order_id',v_order.id,
      'product_key',v_order.product_key,
      'total_amount',v_order.total_amount,
      'grant_type',v_order.grant_type,
      'grant_amount',v_order.grant_amount
    );
  end if;

  if v_order.status = 'refunding' then
    return jsonb_build_object(
      'ok',true,'claimed',false,'already_refunding',true,
      'order_id',v_order.id,
      'user_id',v_order.user_id,
      'telegram_id',v_order.telegram_id,
      'payload',v_order.invoice_payload,
      'currency',v_order.currency,
      'total_amount',v_order.total_amount,
      'charge_id',v_order.telegram_payment_charge_id,
      'grant_type',v_order.grant_type,
      'grant_amount',v_order.grant_amount,
      'product_key',v_order.product_key
    );
  end if;

  if v_order.status <> 'paid' or v_order.telegram_payment_charge_id is null then
    raise exception 'ORDER_NOT_REFUNDABLE';
  end if;

  update public.star_orders
  set status='refunding',
      refund_requested_at=now()
  where id=v_order.id;

  return jsonb_build_object(
    'ok',true,'claimed',true,
    'order_id',v_order.id,
    'user_id',v_order.user_id,
    'telegram_id',v_order.telegram_id,
    'payload',v_order.invoice_payload,
    'currency',v_order.currency,
    'total_amount',v_order.total_amount,
    'charge_id',v_order.telegram_payment_charge_id,
    'grant_type',v_order.grant_type,
    'grant_amount',v_order.grant_amount,
    'product_key',v_order.product_key
  );
end;
$$;

revoke all on function public.claim_star_refund(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_star_refund(uuid)
  to service_role;

create or replace function public.release_star_refund(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_changed integer := 0;
begin
  update public.star_orders
  set status='paid',
      refund_requested_at=null
  where id=p_order_id
    and status='refunding';

  get diagnostics v_changed = row_count;

  return jsonb_build_object('ok',true,'released',v_changed=1,'order_id',p_order_id);
end;
$$;

revoke all on function public.release_star_refund(uuid)
  from public, anon, authenticated;
grant execute on function public.release_star_refund(uuid)
  to service_role;

create or replace function public.apply_star_refund(
  p_payload text,
  p_telegram_id bigint,
  p_currency text,
  p_total_amount integer,
  p_charge_id text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_order public.star_orders%rowtype;
  v_until timestamptz;
begin
  if coalesce(p_payload,'') = '' or coalesce(p_charge_id,'') = '' then
    raise exception 'INVALID_REFUND';
  end if;

  select *
    into v_order
  from public.star_orders
  where invoice_payload = p_payload
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_order.telegram_id <> p_telegram_id
     or p_currency <> 'XTR'
     or v_order.currency <> p_currency
     or v_order.total_amount <> p_total_amount
     or v_order.telegram_payment_charge_id <> p_charge_id then
    raise exception 'REFUND_MISMATCH';
  end if;

  if v_order.status = 'refunded' then
    return jsonb_build_object(
      'ok',true,'applied',false,'order_id',v_order.id,
      'product_key',v_order.product_key,'status','refunded'
    );
  end if;

  if v_order.status not in ('paid','refunding') then
    raise exception 'ORDER_NOT_REFUNDABLE';
  end if;

  if v_order.grant_type in ('supervybe','spotlight') then
    delete from public.paid_rewards
    where source_order_id=v_order.id;
  elsif v_order.grant_type = 'vybe_plus_days' then
    select vybe_plus_until into v_until
    from public.user_entitlements
    where user_id=v_order.user_id
    for update;

    if found then
      v_until := greatest(
        now(),
        coalesce(v_until,now()) - make_interval(days => v_order.grant_amount)
      );

      update public.user_entitlements
      set vybe_plus_until=v_until,
          updated_at=now()
      where user_id=v_order.user_id;
    end if;
  elsif v_order.grant_type = 'test_refund' then
    null;
  end if;

  update public.star_orders
  set status='refunded',
      refunded_at=coalesce(refunded_at,now()),
      refund_requested_at=coalesce(refund_requested_at,now())
  where id=v_order.id;

  return jsonb_build_object(
    'ok',true,'applied',true,'order_id',v_order.id,
    'product_key',v_order.product_key,'grant_type',v_order.grant_type,
    'grant_amount',v_order.grant_amount,'status','refunded'
  );
end;
$$;

revoke all on function public.apply_star_refund(text,bigint,text,integer,text)
  from public, anon, authenticated;
grant execute on function public.apply_star_refund(text,bigint,text,integer,text)
  to service_role;
