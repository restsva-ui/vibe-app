alter table public.star_products
  drop constraint if exists star_products_grant_type_check;
alter table public.star_products
  add constraint star_products_grant_type_check
  check (grant_type in ('supervybe','spotlight','vybe_plus_days','test_refund'));

alter table public.star_orders
  drop constraint if exists star_orders_grant_type_check;
alter table public.star_orders
  add constraint star_orders_grant_type_check
  check (grant_type in ('supervybe','spotlight','vybe_plus_days','test_refund'));

insert into public.star_products (
  product_key,title_uk,title_en,description_uk,description_en,
  stars,grant_type,grant_amount,active,sort_order
) values (
  'test_1_star',
  'Тест оплати • 1 ⭐',
  'Payment test • 1 ⭐',
  'Тестовий платіж на 1 Star. Після успішної оплати бот автоматично поверне цю 1 Star.',
  'Test payment for 1 Star. After a successful payment, the bot will automatically refund this 1 Star.',
  1,'test_refund',1,true,1
)
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

create or replace function public.apply_star_payment(
  p_payload text,
  p_telegram_id bigint,
  p_currency text,
  p_total_amount integer,
  p_charge_id text
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
        'grant_amount',v_order.grant_amount
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
    'grant_amount',v_order.grant_amount
  );
end;
$$;

revoke all on function public.apply_star_payment(text,bigint,text,integer,text)
  from public,anon,authenticated;
grant execute on function public.apply_star_payment(text,bigint,text,integer,text)
  to service_role;
