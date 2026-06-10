# Big Audit — Accounting · Payments · Products (2026-06-10 refresh)

Legacy (`gba_client`) vs current `gba_console` state. This file supersedes the older 2026-05-31 snapshot; use `docs/migration-route-matrix.md` as the route-level source of truth.

## Current Headline

- **Accounting** — all 43 `/accounting/*` route rows are `ui`. Outcome create now covers the migrated host flows: simple order, service-supplier balance top-up, client return, group cash/bank operations, old subpath compatibility, and payment-task redirect into available payments.
- **Payments** — payment registers, banks, articles, online-shop payments, income create, available-payments filters/totals/detail drawer/task documents/marked tasks/outcome creation are wired. Known legacy available-payment task source types are mapped; unknown task types fall back to read-only unsupported state.
- **Products / Supply / Warehouse** — products, product groups, product storages/remains/placements/history/capitalization/availabilities, product-delivery-protocols, warehouse-ukraine, Ukraine supply orders, supply placement, act reconciliations, reports, and resales are marked `ui` in the route matrix.
- **Intentional no-touch areas** — Poland-specific routes stay deferred. Allegro stays todo. SAD and Tax Free are not part of the current workstream.

## Residual Work

| Item | Priority | Notes |
| --- | --- | --- |
| Runtime verification for accounting/payment edge cases | High | Verify against deployed API data for large available-payment task batches, outcome creation from marked tasks, and document-upload state transitions. |
| Advance reports inline polish | Medium | List/detail routes are present; keep checking inline product/fuel edit edge cases while testing real data. |
| Available-payments unsupported fallback monitoring | Medium | Current fallback is intentional and blocks write actions. If a real non-Poland task lands here, add a typed mapper instead of enabling generic writes. |
| Products/client polish | Low | Current code re-audit found no high-confidence active gaps; keep differences like Load-more vs legacy virtual-scroll as accepted console convention unless product owners request exact UX parity. |

## Route-Matrix Snapshot

- `ui`: 133
- `todo`: 2 (`/sales/allegro/new`, `/sales/allegro`)
- `deferred`: 6 (root redirect/obsolete alternate screens/Poland-specific routes)

## Verification Notes

- Product/client micro parity was refreshed on 2026-06-10; stale historical gap lists in older docs are marked as baseline notes, not active missing work.
- Sales document endpoint parity is covered by `src/features/sales-ukraine/api/salesUkraineApi.test.ts`; warehouse sale printing remains separately covered by the warehouse Ukraine migrated-gaps tests.
