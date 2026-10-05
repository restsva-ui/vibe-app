-- RETIRED OPERATIONAL SCRIPT — DO NOT APPLY AS A MIGRATION.
-- Archived on 2026-10-05 after live verification showed product_key=test_1_star is inactive.
-- Kept only as historical evidence of the completed 1-Star end-to-end payment test.
--
-- Temporary 1-Star end-to-end payment test.
-- This product grants the same 5 SuperVYBE pack as the normal 50-Star product.
-- Disable this test SKU immediately after the live checkout test succeeds.

update public.star_products
set
  title_uk = 'ТЕСТ • 5 SuperVYBE',
  title_en = 'TEST • 5 SuperVYBE',
  description_uk = 'Тимчасова тестова покупка: 5 SuperVYBE за 1 Star. Після тесту товар буде вимкнено, основна ціна залишиться 50 Stars.',
  description_en = 'Temporary test purchase: 5 SuperVYBE for 1 Star. After the test this item will be disabled; the normal price remains 50 Stars.',
  stars = 1,
  grant_type = 'supervybe',
  grant_amount = 5,
  active = true,
  sort_order = 1,
  updated_at = now()
where product_key = 'test_1_star';
