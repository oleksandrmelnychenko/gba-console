# Big Audit — Accounting · Payments · Products (2026-05-31)

Legacy (`gba_client`) vs ACTUAL console state (routes + feature folders). The route matrix was stale; this reflects reality after this session's work.

## Headline
- **Accounting** — all 43 `/accounting/*` routes wired. Remaining = advanced sub-flows inside two screens (intentional deferrals).
- **Payments** — registers/banks/articles/online-shop complete; income create complete; **outcome create has only the primary mode**; payment-task per-type editors deferred; TaxFree/SAD outcome-create endpoints not migrated.
- **Products (товари)** — module ~100%. The dominant remaining товари-adjacent gap is the **Supply Orders / Постачання module (~18 routes, ~32k LoC, not started)**. Plus act-reconciliations (2), tax-free carriers (3), Poland surfaces.

## Accounting — remaining
| Item | Severity | What's missing | Legacy ref |
|---|---|---|---|
| Outgoing-cashflow create modes | HIGH | Only `simple` cash-order built. Deferred: organization-payment, payment-tasks, client-return, payment-group (shown "у розробці") | `payment.registers/outcome/out.come.host.view.tsx` + the 4 `new.accounting.out.come.*` views |
| Available-payments deep editors | HIGH | Per-task template editors (ConsumableOrder / delivery-protocol PL+UA / Custom / Vehicle / Transportation / Port / Container), create-outcome-from-marked-tasks UI, document-upload→done UI, cash-flow pivot per task. (List + mark-done + create-outcome endpoints already wired.) | `payments.available/` templates + `supply.payment.task.template.wrapper.tsx` |
| Advance / advanced reports inline add-product/add-fuel | MEDIUM | Inline item editors (view/list present) | `advance.payments/`, `payment.registers/outcome/components/details.advance.report.view.tsx` |
| Income user form completeness | LOW | Spot-verify VAT/exchange vs `income/user/income.order.user.view.tsx` | — |
Correctness spot-checks (payment-accounts, consumable-orders, income forms): OK (income bugs already fixed this session).

## Payments — remaining (overlaps accounting)
- Outcome create modes (same as above) — the main gap.
- Payment-task per-type template editors (deferred in available-payments).
- **TaxFree/SAD-context outcome create NOT migrated**: `/payments/orders/outcome/new/taxfree?taxFreeNetId=`, `/payments/orders/outcome/new/sad?sadNetId=`.
- Registers/banks/articles/online-shop: complete (console even adds get/update for movements + bank update).

## Products + Supply — remaining
| Module | Routes | Size | Status |
|---|---|---|---|
| Products module (товари) | — | — | ~100% (only Poland income `/products/income/poland` + `/products/pl-income-order/:id` deferred) |
| product-delivery-protocols | 4 | — | DONE this session (Poland branch / merged-service edit-task deferred) |
| warehouse-ukraine | 2 | — | DONE this session (`/warehouse/poland` deferred) |
| **Supply Orders / Постачання** | **~18** | **~32k LoC** | **NOT STARTED — biggest gap.** list (AllSupplyUkraineOrdersView), create (NewSupplyOrderView), multi-step edit (SupplyLogisticsPage → supply-invoices / specifications / product-income), overview, placement, protocols (SupplyUkrainePaymentProtocolsView), `/supply-orders/product-placement/:id`. Poland + Ukraine variants. |
| Act reconciliations | 2 | ~2.3k LoC | NOT STARTED (`/ukraine/act/reconcoliation[/:netid]`) |
| Tax-free carriers | 3 | small | NOT STARTED (`/tax-free/carriers/*`) |

Shared infra already migrated that supply-orders can reuse: basket-supply-ukraine-order, sad, tax-free-pack-lists, depreciated-orders, supply-returns, product-delivery-protocols.

## Recommended priority
1. **Complete accounting+payments advanced flows** (bounded, high value): outgoing-cashflow create modes (organization-payment, payment-tasks, client-return, payment-group) + available-payments per-task editors + create-outcome-from-marked + TaxFree/SAD outcome create.
2. **Small gaps**: tax-free carriers (3, small), act reconciliations (2).
3. **Supply Orders module** (huge, ~32k LoC) — its own multi-slice effort; needs a dedicated plan (list → create → multi-step editor → sub-tabs). Largest товари-adjacent work.
4. Poland surfaces (warehouse/poland, products poland income) — deferred per established Poland-deferral policy.
