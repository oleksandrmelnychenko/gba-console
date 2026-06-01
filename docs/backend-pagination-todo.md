# Pagination audit — server-side limit/offset/Total

Full request audit of the console (510 apiRequest endpoints across 94 api files), cross-checked
against the **gba-server** controllers/repositories. Classification:

| Class | Count | Meaning |
| --- | ---: | --- |
| paginated-ok | 39 | already paged end-to-end (sends limit/offset, reads a real Total) |
| frontend-fix | 3 | backend supports paging but the console did not wire it — **fixed on the frontend** (see below) |
| backend-needed | 28 | server returns the whole array (or no Total) — backend must add paging first |
| lookup-exempt | 232 | small reference / dropdown / type-ahead lists — not meant to paginate |
| detail-exempt | 394 | single-entity GET, mutation, count, or document export |

## ✅ frontend-fix (done in the console)

| Screen | Endpoint | Pagination wired |
| --- | --- | --- |
| Авансові звіти (advanced-reports) | `/payments/orders/outcome/all/underreport` | **true paging** — `COUNT(*) OVER()` Total exists; Mantine page + page-size |
| Передзамовлення (sales-preorders) | `/preorders/all/filtered` | **load-more** — backend ROW_NUMBER slice, no Total |
| Клієнти ІМ — пошук (online-shop retail) | `/retail/clients/sales/filtered` | **load-more** — backend ROW_NUMBER slice, no Total |

## ❌ backend-needed (28) — server must add `limit`/`offset` (+ a `Total`/`TotalRowsQty`)

The backend must accept `limit`+`offset` and return a `Total`/`TotalRowsQty` count. Several screens
**already send** `limit`/`offset` from the console but the server ignores them or returns no count, so
they currently load the whole array (or only support count-based load-more). Frontend paging is blocked
until each endpoint below is extended.

### P1 — clients
| Screen | Endpoint | Note |
| --- | --- | --- |
| Per-client sales tab | `/sales/all/client` | only netId/type/from/to filters; whole array |
| Клієнти ІМ (default list) | `/retail/clients/all` | whole `RetailClient` array |
| Незавершені продажі ІМ | `/sales/misplaced/get/all` | only number/from/to/isAccepted filters |
| Нові e-commerce клієнти | `/clients/all/ecommerce` | whole array, no params |
| Клієнти-організації | `/clients/organizations/all` (+ `/all/search`) | neither path pages |

### P2 — products
| Screen | Endpoint | Note |
| --- | --- | --- |
| Витратні накладні | `/consumables/orders/all` | only from/to; raw List, no Total |
| Витратні товари (категорії) | `/consumables/categories/all` | raw list, nested products |
| Витратні склади | `/consumables/storages/all` | raw list, no params |
| Списані витратні | `/consumables/orders/depreciated/all/filtered` | from/to/value/storage only |

### P3 — admin-directory
| Screen | Endpoint | Note |
| --- | --- | --- |
| Постачальники послуг | `/supplies/organizations/all` (+ `/all/search`) | whole list both paths |
| Користувачі | `/usermanagement/profiles/all` (+ `/search`) | whole `User` list |
| Послуги організацій | `/supplies/services/search/organizations/paymenttasks/all` | whole filtered list |
| SEO — клієнти ІМ | `/clients/all/shop` (+ `/clients/retail/set` returns same list) | whole shop-clients list |

### P4 — supply
| Screen | Endpoint | Note |
| --- | --- | --- |
| Кошик переміщення в UA | `/sales/all/filtered/pl-uk` | from/to/value only; whole grouped set |

### P5 — sales
| Screen | Endpoint | Note |
| --- | --- | --- |
| Резерв кошика | `/sales/carts/all` | whole `ClientShoppingCart` list |
| Оферти | `/sales/offers/all/filtered` | from/to only; no limit/offset/total |

### P6 — customs
| Screen | Endpoint | Note |
| --- | --- | --- |
| Tax Free документи | `/supplies/ukraine/order/taxfree/all/filtered` | console sends limit/offset + reads Total, but backend returns no real Total |
| SAD | `/supplies/ukraine/order/packlists/sad/all/filtered` | load-more only; no true Total |
| Звіти ПДВ | `/vats/info/get/filtered` | load-more only; no true Total |
| Акти звірки | `/supplies/ukraine/reconciliation/all/filtered` | only from/to; whole array |

### P7 — accounting
| Screen | Endpoint | Note |
| --- | --- | --- |
| Рахунки оплат | `/payments/registers/all` | `{Collection, TotalEuroAmount}` — Total is a money sum, not a row count |
| Авансові платежі | `/payments/advance/all` | from/to only; whole array |
| Підзвітні витрати | `/consumables/orders/all/services` | from/to/value/org; no Total |
| Шляхові листи авто | `/consumables/company/cars/roadlists/all/filtered` | companyCar/from/to; no Total |
| Оплати ІМ | `/sales/payment/images/get/filtered` | filtered, whole list, no Total |

## Resolved (audit false positive)
`basket-supply-ukraine-order` → `GET /supplies/ukraine/order/cart/items/recommendations` is **valid**:
the route is served by **gba-ecommerce-api** (`SupplyOrderUkraineCartItemsSegments.GET_RECOMMENDATIONS
= "recommendations"`), not gba-server — the audit only checked gba-server. The console faithfully
migrates the legacy `GET_ALL_RECOMMENDATIONS_API`. No fix needed. (Basket recommendations feature
deferred for later review per request.)

Once each backend endpoint above returns `limit`/`offset`/`Total`, wire the standard console
Load-more / page-size pattern (as done for the 3 frontend-fix screens).
