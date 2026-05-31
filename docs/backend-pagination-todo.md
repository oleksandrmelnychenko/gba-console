# Backend pagination TODO (server-side limit/offset/Total)

These console screens CANNOT have client paging bolted on — their endpoints return the
whole array with no `limit`/`offset`/`Total`. The backend must first add server-side
paging (accept `limit`+`offset`, return a `Total`/`TotalRowsQty` count). Frontend paging
is blocked until then. (Flagged by user; "це вже потім" — deferred backend work.)

| Screen | Endpoint to extend |
| --- | --- |
| Підзвітні витрати (accountable-expenses) | `/consumables/orders/all/services` |
| Авансові платежі (advance-payments) | `/payments/advance/all` |
| Кошик поставки в UA (basket-supply-ukraine-order) | `/sales/all/filtered/pl` |
| Нові e-commerce клієнти (new-clients-from-ecommerce) | own endpoint, no params |
| Клієнти інтернет-магазину (clients-online-shop) | `/retail/clients/all` |
| Витратні накладні (consumable-orders) | `/consumables/orders/all` |
| Незавершені продажі ІМ (incomplete-sales-online-shop) | `/sales/misplaced/get/all` |
| Клієнти-організації (organization-clients) | `/clients/organizations/all` |
| Оплати інтернет-магазину (payment-online-shop) | filter endpoint, no paging |
| Групи товарів (product-groups) | `/products/groups/filtered/get` |
| Рух коштів постачальника (supplier-organization cash-flow) | `/accounting/cashflow/get/filtered` |
| Постачальники послуг (supplier-organizations) | `/supplies/organizations/all` |

Once each endpoint returns `limit`/`offset`/`Total`, wire the standard console
Load-more / page-size pattern on the corresponding screen.
