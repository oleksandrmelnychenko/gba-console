# Accounting — Review + Gap Completion (branch clients/full-migration)

User ask (2026-05-30): "зробити ревю по accounting і дотащити все що було пропущено" — review accounting, fix what's broken, migrate everything missed.

## Review (build + correctness)
- Fixed 12→0 tsc build errors across the concurrent WIP: TS enums → `as const` (`payment-accounts/types.ts`, `income-cashflows/types.ts`); missing fields on `NamedEntity` (`Number`) and `OutcomePaymentOrder` (`Comment`, `OutcomePaymentOrderConsumablesOrders`) in consumable-orders; null-guarded label getters; `PaymentRegisterType` cast in payment-accounts list; `OrganizationWithDefaults` narrowing in income-cashflows. User accepted the enum change.
- Adversarial correctness review of all already-migrated accounting features (consumable-orders form/pay, income-cashflows, payment-accounts, payment-expense-articles, outgoing-cashflows, advance-payments, advanced-reports, consumable-storages, vat-reports, accountable-expenses): **0 high-confidence bugs**. Endpoints, payload shapes, enum numeric values, cancelled-guards all verified faithful. Two benign cosmetic notes (advance-payments date format `YYYY-MM-DD` vs legacy ISO — backend-tolerant; conversion/OtherIncome `ExchangeRate` omitted — informational).

## Gaps migrated (every legacy /accounting + /payments route now has a console counterpart)
- ✅ `company-cars` — list + new/edit + `:id/road-lists` (`/consumables/company/cars/*`, `/roadlists/*`).
- ✅ `currency-convertors` — list + new/edit + exchange-rates drawer (`/currencies/traders/*`).
- ✅ `payment-online-shop` — `/accounting/payment-online-shop` (`/sales/payment/images/get/filtered`, add/edit image, paid/status columns, and create-income-order redirect into `/accounting/income-cashflows/new/shop` with sale/client/agreement/amount query prefill).
- ✅ `balances` — `/accounting/sync/documents` (`/documents/sync/get`).
- ✅ `available-payments` — `/accounting/available-payments` + `/payments/available` (grouped payment tasks `/payments/tasks/grouped/all/filtered`, filters, per-currency totals, detail drawer, task document upload/delete overrides, move-to-payment, marked tasks, merge, create outcome from marked tasks, cash-flow pivot, and source/detail drill-ins). Poland-specific source navigation remains intentionally non-navigable under the current migration rules.
- ✅ `outgoing-cashflow/new` — outcome create host and implemented modes: primary cash order, organization payment, payment tasks redirect, client return, payment group, and supplier/payment counterparty flows.
- ✅ `outgoing-cashflow/:id/advanced-report/view` — advance-report detail (`/payments/orders/outcome/get` + `/calculate` + `/update?auto=`); load/view/remove/recalculate/save, product/fuel row removal guards, consumable document preservation, and auto-income toggle.

## Gate
All migration code: tsc 0, eslint 0. Full `npm run build` GREEN, tests 34/34 (after the WIP build-error fixes — the tree now compiles end-to-end).

## Commit
Historical note only. The active migration state is tracked in `docs/migration-route-matrix.md`.
