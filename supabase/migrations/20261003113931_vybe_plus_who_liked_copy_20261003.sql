
update public.star_products
set
  description_uk='Сім днів доступу до «Хто лайкнув мене». Термін додається до вже активного VYBE+.',
  description_en='Seven days of access to “Who liked me”. Time is added to any active VYBE+ period.',
  updated_at=now()
where product_key='vybe_plus_7d';
