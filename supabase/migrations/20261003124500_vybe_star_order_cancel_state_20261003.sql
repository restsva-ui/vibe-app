alter table public.star_orders
  drop constraint if exists star_orders_status_check;

alter table public.star_orders
  add constraint star_orders_status_check
  check (status in ('pending','paid','failed','expired','cancelled','refunded'));

create index if not exists star_orders_user_status_created_idx
  on public.star_orders(user_id,status,created_at desc);
