# Parity review notes — «штуки» to review later

Running log of parity nuances, deliberate divergences, deferred items, and not-migrated
screens surfaced while migrating the legacy GBA client into this console. Nothing here is a
blocker; these are items to look at together and decide on. Newest sections appended over time.

---

## 1. Permission-gate parity (audited 2026-06-01, branch `clients/full-migration`)

Full audit of all **158 legacy `<PermissionCheck permissionKey=>` gate sites (81 files)** vs the
console. Result: near-full parity already in place. 3 real gaps closed in commit `1958ced`
(sales-ukraine "Відкрити продаж", warehouse placement Add/Cancel/Save, warehouse strict tab
hiding). The items below are the ones worth a second look.

### 1a. Behavioural nuance — «Відкрити продаж» now fully gated
- **What:** the sales-ukraine row action «Відкрити продаж» is now gated behind
  `UkraineAllActOfEdit_Change_PKEY` (matching legacy `sale.statictic.item.tsx:181`, which gates the
  edit-open action with this key + the `InputSaleMerges.length === 0` guard).
- **Consequence:** a non-privileged user **without** this key can no longer open the sale drawer at
  all — not even read-only. This is faithful to legacy (legacy gated the same edit-open action).
- **To decide:** if we want a separate read-only "view sale" entry for users without edit rights,
  that is a **product decision beyond parity** — legacy does not have one. Left as legacy for now.

### 1b. Not-migrated permission gates (console element/feature does not exist yet)
These legacy gates have **no console counterpart because the underlying action/element is not built**
— they are NOT gate bugs. Add the gate when/if the feature is built.

| Legacy key | Where (legacy) | Why not migrated |
| --- | --- | --- |
| `PlacementHeader_ActReconciliationNew_ordersUkrainePlacement_PKEY` | placement.header.view.tsx | console placement editor has no "ActReconciliation new" action |
| `PlacementHeader_…_CarryOut` (Провести / full-placement) | placement.header.view.tsx | console has no CarryOut/FullPlaced action |
| `PlacementHeader_…_GetUp` (Підняти) | placement.header.view.tsx | console has no GetUp action |
| `Sales_Ukraine_all_Change_Products_Btn_PKEY` | shared product carousel | console renders product description read-only; editing goes through the full edit panel gated by `Product_Entire_Assortment_EditBtn_PKEY` instead |

### 1c. Audit-tooling note (not a product issue)
The Workflow `args` blocklist did not reach the script in the permission run (logged "0 WIP files
blocked"); fixes still landed only in non-WIP files. Inline data arrays in workflow scripts rather
than relying on `args` until that is understood.

---

## 2. Coverage map — legacy screens vs console (audited 2026-06-01)

Read-only coverage audit (run `wf_1e850bd2-309`) of every legacy GBA screen mapped to its console
counterpart. **Totals: 77 migrated · 46 user-WIP (you're actively building) · 3 partial ·
10 not-migrated · 2 do-not-touch (Allegro).**

| Legacy area | migrated | your WIP | partial | not-migrated | do-not-touch |
| --- | ---: | ---: | ---: | ---: | ---: |
| Accounting (accouting/*) | 16 | 6 | 0 | 1 | 1 |
| Analytics: supply + supply.ukraine | 4 | 10 | 0 | 6 | 0 |
| Analytics: SAD + Tax Free + Act Reconciliations | 7 | 12 | 0 | 0 | 0 |
| Clients (all/edit/new/online.shop/resources/shared) | 16 | 12 | 0 | 0 | 0 |
| Products (+ groups) | 4 | 5 | 0 | 0 | 0 |
| Managers (sale/offer/resale/allegro/dashboard) | 13 | 1 | 3 | 2 | 1 |
| Online shop SEO + Organization clients | 13 | 0 | 0 | 0 | 0 |
| Misc (agreements/countries/incoterms/dashboard/consignment) | 4 | 0 | 0 | 1 | 0 |

### 2a. Actionable backlog — genuinely missing, **decide whether to build**

| # | Screen | Status | What's missing in console | Recommendation |
| --- | --- | --- | --- | --- |
| A1 | **Client returns** (dashboard/client.returns.pivot) | partial | Pages exist (`SalesReturnClientPage` `/sales/return/client`, `NewUkraineSaleReturnPage`), but **no "Returns" tab in `SalesDashboardShell`** (not reachable from the dashboard as in legacy) and **no `ClientReturnsReportPanel`** report. `sales-returns` is NOT in your WIP. | Add the Returns dashboard tab + the report panel → faithful to legacy. Safe (no WIP collision). |
| A2 | **New-sale wizard** audit screen (`sale.statictic.audit.view.tsx`) | partial | Console folds creation into `NewSaleModal` + `SaleEditorDrawer` (these DO have reassign + merged sales). Missing: the legacy **SaleStaticticAuditView** ("act for editing"/statistics audit screen) reached from the Clients step. | Decide if the audit screen is still needed; if yes, port it. |
| A3 | **New-offer wizard** client-step (`offer.master.view.tsx`) | partial | Console collapses the legacy 2-step master view into a single `NewOfferModal`. Full client-step parity (sub-client / trade-point selection + agreements) and the keyboard-state UX are not reproduced 1:1. | Decide: keep the simplified modal, or rebuild the faithful client step. |

### 2b. Dead / disabled in legacy — **likely intentionally dropped** (verify, probably no action)

| Screen | Why it looks intentional |
| --- | --- |
| **Payment Register Transfers** (payment.registers/transfers/*) | Not wired to any route in legacy `route.config.ts`; inter-account moves are folded into income/outgoing cashflow flows. |
| **Orders pivot** (dashboard/orders.pivot) | DEAD code — not imported by `sales.manager.dashboard.tsx`, not referenced anywhere in the legacy client. |
| **Debts pivot** (dashboard/debts.pivot + top-clients-debt / top-debts-managers charts) | DEAD code — not imported by the active dashboard. The active "Debtors" tab is `DebtorsView`, not this pivot. NB: the two debt charts were **not** ported into `sales-charts` — port only if you want them. |
| **Financial Dashboard** (dashboard/DashboardPage.tsx: totals cards, EnterpriseBalance pie, PaymentRegisterChart, Invoices/Factures + StatementOfFunds panels) | The **entire render body is commented out** in the legacy client (JSX comment ~lines 69–134) → already disabled in old client. Console `/dashboard` is the migration-status landing page. Likely dropped on purpose; confirm. |

### 2c. Deferred — Poland + Allegro (per standing directives)

- **Poland supply orders (6 screens)** — entirely missing, but **Poland surfaces are deferred** per
  earlier directive. The Ukraine analogues exist (mostly WIP). Screens: Poland orders list
  (`/orders/poland/all`), new-order wizard (`/orders/poland/all/new`), order editor / logistics path
  (`/orders/poland/all/edit/:id`), supply-invoices, specifications grid, product-income (the
  `/edit/:id/*` sub-routes). Build only when Poland is un-deferred.
- **Allegro** (managers/allegro) — **do-not-touch** per directive. Not migrated, not audited.

---

## 3. Built — Client returns dashboard tab + report panel (A1, 2026-06-01)

Closed backlog item **A1**: added the **"Повернення"** tab to `SalesDashboardShell` (legacy
position 6, between Передзамовлення and Рух товару клієнта), wrapped `/sales/return/client` in the
dashboard shell, and built **`ClientReturnsReportPanel`** (`sales-returns/components/`) — a faithful
port of the legacy `ClientReturnsReportPanel`: From/To (default today), searchable Client select,
"Тільки мої клієнти" (resets client) ↔ client-select (clears onlyMy), Grouped/Detail type, Generate
→ existing `exportSaleReturnsReport` (`/sales/returns/document/export`) → Excel/PDF download links.
Adversarially verified (parity / Mantine / regression) — fixed one medium issue (state now resets on
close so each open is fresh, like legacy's remount-on-open).

**Known intentional divergence (low):** the report's Client dropdown does **not** pre-populate the
first N clients on open — it requires ≥2 typed characters before searching (`/search/by/query`,
limit 20). Legacy pre-loaded the first 10 with an empty query. Kept the ≥2-char gate because it is
the **console-wide search idiom** (the sibling `SalesReturnClientPage` create flow does the same).
Revisit if you want the pre-populated list.

---

## 4. Backlog re-verified — A2 & A3 are essentially already migrated (corrects §2a, 2026-06-01)

Deep legacy-vs-console diff (run `wf_24fef1b7-5fc`) showed the coverage audit **overstated** both
A2 and A3. The actionable functionality is already present; only LOW/medium edges remain, and each
carries a share-vs-duplicate design decision — **left for review, not built**.

### A2 — sale audit screen — already migrated (under a different feature)
The full legacy `SaleStaticticAuditView` is faithfully reimplemented in
**`features/clients/components/sales/SalesPanel.tsx`** (`AuditTimeline` + `LifeCycleRow` +
`AuditOrderItem`): Logistics lifecycle timeline (`SaleExchangeRates` + `LifeCycleLine`), shifted-items
viz (`Order.OrderItems[].ShiftStatuses`), and **both** per-item print buttons (invoice/A-form via
`/sales/get/document/history`; act-for-editing/C-form via `/sales/get/shifted/hisotry/document`).
Backed by `getSaleStatisticBySaleId` → `GET /sales/get/shifted`
(`SalesController.GetSaleByNetIdWithShiftedItemsAsync`). Separately, the document downloads are
ALSO in `sales-ukraine/components/SaleDocumentsMenu.tsx`. Remainders:
- **(low/medium) No audit entry-point on the `sales-ukraine` sale row** (the legacy statistic icon).
  The timeline is reachable per-client (clients sales tab) but not from the sales dashboard row.
  Building it = reuse the clients `AuditTimeline` → **decision: move it + the SaleStatistic api/types
  to `shared/ui`, or leave it (audit already reachable per-client).** No backend work; data exists.
- **(low) `ConfirmProcessing` action** — dead code in BOTH legacy (button gated behind a rarely-set
  `PanelModel.SelectNetUId`) and console (`confirmSaleActForEditing` wrapper exists in
  `clients/api/clientSalesApi.ts` but is never called). Endpoint exists
  (`protocol/act/invoice/set/edit/act/for/editing`). Recommend leave — matches legacy's dead state.

### A3 — offer client-step — already migrated
`NewOfferModal` faithfully covers offer creation: client search (`/clients/payers/search/all`),
client **agreements** (`/agreements/client/all?netId=` — the audit's "missing agreements" claim was
WRONG), product step (`/products/search/vendorcode`), submit to `/sales/offers/new` with the
identical `ClientShoppingCart` shape, and the generated public-link result. The legacy client-step's
sales-register/debt UI is shared-component chrome, not part of offer creation (correctly omitted).
Remainder:
- **(low) Sub-client / trade-point selection** — legacy `ClientDataCarousel` can raise the offer
  against a sub-client or trade-point (reloading that entity's agreements). `NewOfferModal` lists only
  top-level payers. Data available (clients feature wraps `getClientSubClients` etc.). **Decision:
  build if offers-against-sub-clients is wanted; else leave.**

**Net:** the migration is more complete than §2a implied. No remaining item is a clean must-build
faithful gap — all are edges + design decisions for review.

### Resolved (built on request)
- **A2 entry-point — BUILT** (commit `5826f5c`). Extracted the audit timeline to `src/shared/sale-audit`
  and added an "Історія редагувань" audit drawer to the sales-ukraine sale row. The `ConfirmProcessing`
  action remains intentionally unbuilt (dead code in both legacy and console).
- **A3 sub-client/trade-point — BUILT** (commit `9ac7903`). `NewOfferModal` now loads the selected
  client's sub-clients and lets you raise the offer against a sub-client/trade-point (agreements reload
  for the picked entity). Adversarial verify caught a wrapper-shape bug (endpoint returns
  `ClientSubClient` links, not flat clients) — fixed by projecting `.SubClient`.

---

## 5. Sales-ukraine: SignalR live updates + sale-state audit (2026-06-01)

### SignalR — DONE (commit `efd6dc8`, verified)
The sales-ukraine list subscribes to the realtime `saleAdded` / `saleUpdated` hub events and does a
debounced (800ms) `reload()` of the current page. Because the list is server-paginated, a full-page
refetch is the correct equivalent of the legacy `GetAll()`-on-SaleUpdated (a client-side `unshift`
would desync pagination/totals); the server filter keeps Poland `'P'` sales out. Adversarial verify
of the wiring passed (stable listener, no leak/re-subscribe, timer cleanup, drawers undisturbed).

### Sale-state audit ("перевір всі стейти") — enum coverage COMPLETE, but labels/gating diverge
Every legacy lifecycle value (0,1,2,3,4,5,100,101,102) and payment value (0,1,2,3) is handled with no
fallthrough/crash. The divergences below are **pre-existing** (from the original SalesAndInvoices
migration, not the SignalR change) and are wording/behaviour judgment calls — listed for review.

**(HIGH) Lifecycle status LABELS differ from legacy.** Legacy `SaleLifeCycleStatusConvertor` labels
the sale by its DOCUMENT stage; the console uses process-status names:

| value | legacy label | console label |
| --- | --- | --- |
| New (0) | Рахунок | Новий |
| Packaging (1) | Накладна | Пакування |
| Packaged (2) | Накладна *(same as Packaging)* | Запаковано |
| Shipping (3) | Відправлено | Доставка |
| Received (4) | Отримано | Отримано |
| Await (5) | Очікування | Очікує |
| OrderClosed (100) | Закриті рахунки | Закритий |
| TransporterChanged (101) | Редаговані перевізники | Змінено перевізника |
| InvoiceChanged (102) | Редаговані накладні | Змінено рахунок |

If parity is wanted this is a mechanical `STATUS_LABELS` edit. **Decision needed: align to legacy, or
keep the console wording?**

**Action-gating divergences vs legacy `sale.item.tsx`:**
- (HIGH) `showTtn` is `TransporterId && lifecycle===1` — legacy shows TTN/invoice/shipment for BOTH
  Packaging(1) AND Packaged(2) (both map to "Накладна"). So a Packaged sale loses its TTN/print
  actions in the console. (The dropped `IsSalesView` guard is moot — always true in this grid.)
- (HIGH) `Відвантажити` (ship → sets lifecycle 2) has no legacy pivot-row equivalent (legacy ships via
  a separate flow). Likely an intentional console feature — **confirm keep vs remove.**
- (MEDIUM) Legacy hides the whole print/TTN block for `IsVatSale && !IsAcceptedToPacking && !isAdmin`;
  the console always shows it (needs the current user's GBA/Administrator role).
- (MEDIUM) Legacy prefixes the status label with `(ПДВ) ` for VAT sales; the console drops it (it shows
  a separate ПДВ badge instead).
- (LOW) payment-status cell only colours some values; `lifecycleStatusFromNumber` ignores All=6.

**Decision needed (see questions):** which of these to align to legacy.

