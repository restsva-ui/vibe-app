-- VYBE 0.9.45 — transactional account deletion with payment-safe retention.

alter table public.star_orders
  alter column user_id drop not null;

alter table public.star_orders
  add column if not exists user_deleted_at timestamptz;

alter table public.star_orders
  drop constraint if exists star_orders_user_id_fkey;

alter table public.star_orders
  add constraint star_orders_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

create or replace function public.vybe_delete_account(p_user_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_photo_url text;
  v_admin_role text;
  v_support_deleted bigint := 0;
  v_events_deleted bigint := 0;
  v_deliveries_deleted bigint := 0;
  v_unpaid_orders_deleted bigint := 0;
  v_financial_orders_retained bigint := 0;
  v_user_deleted bigint := 0;
begin
  if p_user_id is null then
    raise exception 'INVALID_USER';
  end if;

  select au.role
  into v_admin_role
  from public.admin_users au
  where au.user_id = p_user_id
  limit 1;

  if v_admin_role is not null then
    raise exception 'ADMIN_ACCOUNT_DELETE_BLOCKED';
  end if;

  if exists (
    select 1
    from public.admin_audit_log l
    where l.actor_user_id = p_user_id
  ) then
    raise exception 'ADMIN_AUDIT_RETENTION';
  end if;

  perform 1
  from public.users u
  where u.id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'deleted', false,
      'already_deleted', true
    );
  end if;

  select p.photo_url
  into v_photo_url
  from public.profiles p
  where p.user_id = p_user_id
  limit 1;

  delete from public.support_tickets
  where user_id = p_user_id;
  get diagnostics v_support_deleted = row_count;

  delete from public.notification_events
  where recipient_user_id = p_user_id
     or actor_user_id = p_user_id;
  get diagnostics v_events_deleted = row_count;

  delete from public.notification_deliveries
  where recipient_user_id = p_user_id
     or actor_user_id = p_user_id;
  get diagnostics v_deliveries_deleted = row_count;

  delete from public.star_orders
  where user_id = p_user_id
    and status not in ('paid','refunding','refunded');
  get diagnostics v_unpaid_orders_deleted = row_count;

  update public.star_orders
  set user_id = null,
      user_deleted_at = coalesce(user_deleted_at, now())
  where user_id = p_user_id
    and status in ('paid','refunding','refunded');
  get diagnostics v_financial_orders_retained = row_count;

  delete from public.users
  where id = p_user_id;
  get diagnostics v_user_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'deleted', v_user_deleted = 1,
    'photo_url', v_photo_url,
    'support_deleted', v_support_deleted,
    'notification_events_deleted', v_events_deleted,
    'notification_deliveries_deleted', v_deliveries_deleted,
    'unpaid_orders_deleted', v_unpaid_orders_deleted,
    'financial_orders_retained', v_financial_orders_retained
  );
end;
$$;

revoke all on function public.vybe_delete_account(uuid)
  from public, anon, authenticated;
grant execute on function public.vybe_delete_account(uuid)
  to service_role;
