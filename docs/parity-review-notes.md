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
| `PlacementHeader_ActReconciliationNew_ordersUkrainePlacement_PKEY` | placement.header.view.tsx | drawer + API **BUILT** (§13); only the header button-wire is pending (placement page is user-WIP) |
| ~~`PlacementHeader_…_CarryOut` (Провести / full-placement)~~ | placement.header.view.tsx | **BUILT** — see §11 |
| ~~`PlacementHeader_…_GetUp` (Оприходувати / partial-placement)~~ | placement.header.view.tsx | **BUILT** — see §11 |
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

### Sale-state alignment — DONE (commits `59de282` + `331fd34`, verified faithful)
Per your decision to align everything to legacy:
- Lifecycle `STATUS_LABELS` now match `SaleLifeCycleStatusConvertor` + UA locale exactly (Рахунок /
  Накладна / Накладна / Відправлено / Отримано / Очікування / Закриті рахунки / Редаговані перевізники /
  Редаговані накладні).
- `(ПДВ) ` prefix added to the status label for VAT sales (the separate ПДВ badge kept — legacy also
  had a distinct VAT element).
- TTN / invoice / shipment-list now show for Packaging(1) **and** Packaged(2) (grid + `SaleDocumentsMenu`).
- The whole print/TTN block is hidden for `IsVatSale && !IsAcceptedToPacking && !isAdmin`
  (admin = Administrator/GBA from auth) — the legacy stripped branch. Status label still shows;
  «Не буде відвантажено» stays independent.
- The «Відвантажити» row action (lifecycle 1→2) was **removed** (no legacy pivot equivalent) and the
  orphaned `SaleShipModal` deleted. Shipping happens via the legacy flow / accept-to-packing
  («Не буде відвантажено»).
Adversarial verify confirmed faithful (labels exact, gating conditions exact, `IsSalesView` is always
true in this grid, no regression). eslint 0 / tsc 0.

### Residual state items dotted (commit follows §5)
- **Unpaid emphasis — DONE.** The «Сума» amount block now renders red for unpaid sales
  (`SalePaymentStatusType === 0`), matching the legacy `not_paid` price highlight.
- **Realtime reload polish — DONE.** Realtime-triggered reloads are now *silent* (no loading-spinner
  flash, header badge stays) and *non-destructive* (a transient background-fetch failure keeps the
  current rows instead of wiping the grid / showing an error). User-triggered reloads behave as before.
- `OrderWillNotBeShipped_Btn_PKEY` permission mapping **verified** correct; no change.

### Residual low/cosmetic items — now DONE (per request to align all)
- **NotPaid label — DONE.** Aligned to the legacy locale `Неоплаченно` (matching `SalePaymentStatusNotPaid`
  exactly, including the legacy spelling). Paid/PartiallyPaid already matched.
- **Lifecycle `All`(6) — DONE.** `lifecycleStatusFromNumber` now has an explicit `case 6 → 'All'` instead
  of falling through to the raw number (still filter-only; never stamps a real sale row).
- **Order-source row icon — DONE.** The Number column now leads with a source indicator driven by
  `Order.OrderSource` (Shop=0 → **Microsoft Edge logo** `IconBrandEdge` «Інтернет-магазин» — matching
  the legacy `.data_shop__icon` → `\ea2d` Microsoft_Edge_logo glyph; Offer=2 → tag «Оферта», Local=1 →
  invoice «Накладна» at the Packaging/Packaged stage else receipt «Рахунок»). The `sales-online-shop`
  list also leads its Number column with the Edge source icon (commit `6fb6b7b`).

## 6. Sibling sales-dashboard tabs — parity audit + fixes (2026-06-01)

Audited the 8 non-WIP sibling sales tabs vs legacy (run `wf_64e149b5`): 3 HIGH, 11 MEDIUM, 20 LOW.
**21 actionable (HIGH + small faithful) fixes applied + per-tab adversarially verified, commit
`a75a1e1`** (tsc 0 / eslint 0):
- **sales-online-shop:** legacy lifecycle labels + `Неоплаченно`; SignalR live updates (gated like
  sales-ukraine); MisplacedSaleId «Часткова продажа» red indicator.
- **client-product-movement (CRITICAL):** multi-org filter now sent as repeated `organizationId` keys
  (was comma-joined → silently ignored); spec-code header «Митний код»; qty header «штук».
- **sales-offers:** «partial» reason badge red (not orange); reason status over ALL items; «дн.»/«На
  договір» labels; per-line not-processed gating.
- **sales-charts:** Top N-X header «Код Виробника»; by-client legend; zero/empty-money + empty
  by-manager grid handling.
- **sales-debtors:** drop empty `typeCurrency`. **shopping-cart-reserve:** per-item comment cell.
  **sales-preorders:** page title. **sales-prediction:** empty-state.

### Feature gaps — BUILT (commit `745548c`, per-feature verified, tsc 0 / eslint 0)
- **sales-online-shop:** red unpaid-amount emphasis + payment-status colour-by-type + retail (ПО)/(ЧО)
  full/partial suffix (mirrors sales-ukraine / legacy `sale.item.status`).
- **client-product-movement:** client picker switched to the full Client search (`/search/by/query`,
  filter on RegionCode.Value / FullName / USREOU) — non-payer clients with movements now selectable.
- **sales-offers:** per-line single-item reason entry — the not-processed line badge opens the existing
  reason drawer scoped to that one order item (legacy `OnOpenOrderItemReason`).
- **sales-prediction:** dynamic by-client/by-product legend naming the entity + month horizon + Y-axis
  «Сума продажу в євро» label.

### Judgment calls — DECIDED
- **sales-debtors client column:** keep correct «Клієнт» (legacy used the `Supplier` key → «Постачальник»,
  a legacy bug — NOT replicated).
- **sales-preorders tab:** renamed «Передзамовлення» → «Зацікавленість» (legacy Interest), commit `745548c`.

### Remaining — still open (low / large / for review)
- **sales-online-shop row ACTIONS — BUILT (commit `e832b7c`).** Ported the full legacy SalesPivot row
  action surface into the online-shop list, reusing the sales-ukraine components/handlers (no
  duplication) with identical gating + permission keys: Details, SaleDocumentsMenu (gated by
  `hidePrintBlock`), Open editor, Print TTN, Will-not-ship/accept-to-packing, Unlock, Історія редагувань,
  one-time discount (New/Packaging), clickable transporter. `SalesOnlineShopSale` was extended with the
  action-required backend fields; the sales-ukraine components are bridged via one localized
  `asUkraineSale` (`as unknown as SalesUkraineSale`) boundary cast — justified because it's the identical
  `/sales` backend entity (the two features keep parallel type definitions; the cast also masks a handful
  of drawer-read fields not added to the narrower online-shop type — functionally safe, present in the
  JSON at runtime). Existing online-shop features (Edge icon, retail line, MisplacedSaleId, red-unpaid,
  realtime, filters, details) preserved. Adversarially verified (ok=true). A future cleanup could unify
  both features on one shared sale type to drop the cast.

---

## 7. Accounting + clients/org parity audits (2026-06-01)

Extended the deep parity audit beyond sales. Two read-only audits → triaged → applied the clear
faithful fixes (per-screen verified, tsc 0 / eslint 0), recorded the intentional/judgment/large items.

### Accounting (8 screens, run `wf_198862fd`) — fixes in commit `dfedfe5`
Applied: income-cashflows FromDate-desc sort + reset-from=today-7 + empty money → `0,00`;
accounting-cash-flow «На логістичний шлях» supply-order link enabled; payment-accounts register-type
labels + empty money; advance-payments empty money + titles/date; advanced-reports PayedTo marker;
currency-convertors exchange-rate precision (2 fixed decimals) + rate-row date.
- **⚠ PLN HIGH = FALSE POSITIVE — NOT changed.** The audit flagged the console dropping PLN
  (currency-convertors `CURRENCY_ORDER=[EUR,USD]`, payment-accounts `SKIPPED_CURRENCY_CODE=PLN`) as a
  HIGH bug. This is an **intentional console decision** (you reverted my earlier PLN change). PLN was
  NOT re-added anywhere.
- **Money format kept uk-UA, not legacy dot.** The fix agents initially switched money to legacy
  `toFixed(2)` (dot, no grouping); I reverted that to the console-wide `Intl uk-UA` grouping
  (`1 234,50`) for consistency with the sales screens — adopting only the legacy *intent* (always show
  `0,00`, never «—»). The legacy non-localized dot-format is a deliberate console-localization divergence.
- Skipped (recorded): income detail-drawer extra fields; cash-flow per-type drill-in document panels +
  Poland `/orders/poland/all/edit` link (route not yet registered); payment-accounts filter-cookie
  persistence; advanced-reports Document-Structure action; date-serialization toDateString-vs-ISO
  (console uses ISO app-wide; backend accepts). All medium/large or convention.

### Clients/org (5 screens, run `wf_8ac8e34c`) — fixes in commit `fa53c81`
Applied: supplier-organizations Currency/Organization columns join ALL agreements (was first-only);
organisation-services status labels (`Не завершено`/`Оплачено частково`); online-shop-seo add-warehouse
storage list → `/storages/get/all`.
- Recorded (intentional/judgment, NOT changed): organization-clients ≥1-agreement validation +
  agreement auto-persist (console behaviour, arguably better); uk-UA money grouping (console convention);
  organisation-services hardcoded-per-collection service label + IsPayed status branch + the 2 extra
  service collections; assorted LOW money/label items.

**Note on WIP:** during these fixes the user was actively editing other features (available-payments,
consumable-orders, outgoing-cashflows, product-delivery-protocols, supply-ukraine-orders) — only
explicit non-WIP paths were committed.
- **sales-charts:** by-client mount-time empty fetch (minor); client/manager search sources
  (payers/managers vs legacy charts dropdowns) — "confirm with product".
- **sales-debtors day labels:** «Борг через N днів» (console interpolates the count — more informative)
  vs legacy static per-option phrases — kept the console version (enhancement).
- **sales-prediction product name:** console renders `NameUA || Name` (the sibling-wide idiom) vs legacy
  `Name` only — kept the console idiom.
- **Latent (shared):** payment `SalePaymentStatusType` strict `=== 0` comparison on a `number|string`
  type (sales-ukraine + sales-online-shop in lock-step). Harden both with `getNumber()` only if the API
  ever sends the status as a string.

### Remaining — Poland (deferred)
- **sales-offers public link:** legacy `getOfferUrl` switches the ecommerce host UA/Poland by locale;
  the console hardcodes the UA host. Poland is deferred.

---

### Realtime relevance gating — DONE (commit follows)
The realtime listeners now **parse the payload** (`resolveRealtimeSale` = `payload.Sale ?? payload`,
matching the legacy `SaleStatistic` wire shape) and gate the reload:
- **saleUpdated** → debounced reload only when the updated sale's `NetUid` is in the currently-visible
  page (`salesRef.current`), or when the payload can't be identified (safe fallback). No more reloading
  for off-screen sales the user isn't looking at.
- **saleAdded** → skip Poland `'P'` sales (the legacy gate; the server already excludes them from the UA
  list), otherwise debounced reload.
Adversarially verified faithful + React-correct (stable listeners, no stale closure / re-subscribe /
leak; debounce + silent non-destructive reload intact). **Known trade-off:** an update that moves an
*off-screen* sale *into* the active filter isn't reflected until a manual refresh — intentional (the
whole point was to stop reloading on every event); broaden the gate later if inbound-into-filter
parity is ever wanted.


---

## 8. Products / customs / consumables parity audit (2026-06-01)

Read-only audit of 8 non-WIP screens → fixes in commit `0eafa3f` (tsc 0 / eslint 0; verified):
- **transporters (HIGH):** Archive/«Усі» filters were wired to `/transporters/all/type/hidden`
  (backend `GetAllByTransporterTypeNetId` = active-only) then force-marked Deleted, so Archive showed
  active rows + «Усі» showed everything as «Архів». Now a single `/transporters/all/type` fetch
  (backend `GetAllByTransporterTypeNetIdDeleted` = active+deleted) split client-side by `Deleted`,
  matching ClientResourcesPage + the gba-server repo. (Two cross-talk verifier comments wrongly called
  this a regression — dismissed against the backend SQL.)
- **vat-reports (HIGH):** Type column was inverted — fixed to Sale→«Інвойс», SupplyInvoice→«Фактура»;
  + index column + empty-money 0,00.
- **act-reconciliations:** single-income «Причина» now on the wire (request parity — the server ignores
  it on the single path in both legacy and console, so functionally a no-op but byte-matches legacy);
  placement fields required; rows OrderByDescending. (Storage-column-from-sorted side-effect is inert.)
- **product-groups:** create-flow omits the empty-GUID `netId` param; no forced `IsActive`.
- **product-specification-codes:** unsaved-changes confirm on close.
- **tax-free-carriers:** passport dates default to today on create (edit preserves stored dates —
  better than legacy's reset-to-today quirk); hide Add-passport while an unsaved passport exists.
- **consumable-products:** supply-service category label.

Recorded (intentional/judgment, not changed): the date-boundary serialization (console date-only
filters work app-wide); act-recon bulk-process Preview panel (large); plus the usual uk-UA/PLN.

---

## 9. Накладні + Рахунки — deep extraction vs console (run `wf_73353e85`, 2026-06-01)

Exhaustive extraction of the sale **Видаткова Накладна** + **Рахунок на оплату** ecosystem:
**85 items — 58 present · 9 partial · 13 missing.** The console has most of it; the actionable
sales-ukraine gaps:

### Missing (sales-ukraine relevant)
- **Invoice button uses the wrong endpoint.** Legacy «друк видаткової накладної» = `GET /sales/get/document?netId=&isFromStorages=` and toggles `IsPrinted` + re-saves the sale. Console `getSaleInvoiceDocument` calls `/sales/get/last/document` (the LAST/most-recent-revision form) and has no `isFromStorages` / no `IsPrinted` side-effect. If the two endpoints differ, the printed накладна can differ.
- **Рахунок bundles a накладна that the console drops.** `/sales/get/payment/document` can return `InvoiceDocumentURL`/`PdfInvoiceDocumentURL` (a second «Видаткова накладна») alongside the рахунок — revealed when `IsAcceptedToPacking` OR the user is GBA/Administrator/FinanceDirector/Accountant. Console `extractDocumentResult` only reads `DocumentURL`/`PdfDocumentURL`, so the bundled накладна + the role gate are dropped.
- **VAT convert-to-invoice path missing.** Confirming a VAT sale legacy hits `POST /sales/update/get/payment/document` (persists + returns the рахунок inline). Console `SaleEditorDrawer.convertToInvoice` ALWAYS uses the non-VAT `POST /sales/update/file` (IsPrintedPaymentInvoice=true), never branching on `IsVatSale` — so the рахунок isn't auto-generated at VAT confirmation.
- **Current Act-protocol-edit document.** `/sales/get/shifted/document?netId=&IsPrintedActProtocolEdit=` (+ the `IsPrintedActProtocolEdit` flag toggle). Console only has the per-history-edit «C» form (`/sales/get/shifted/hisotry/document`), not the current-state one.
- **Cannot CREATE an invoice edit (Акт редагування).** Legacy `edit.sale.view.tsx` shifts order-item qty bill↔store (`/orders/items/shift/current`), which CREATES `HistoryInvoiceEdit` entries. Console is **read/print-only** for invoice history — there is no console flow to edit an issued накладна.
- **`ConfirmProcessing` approve** (set/edit/act/for/editing) — the per-sale approve button from the legacy audit timeline is not in the console audit drawer.

### Belongs to warehouse-ukraine (verify there, not a sales-ukraine gap)
Invoice register (`/sales/get/register/invoice` + `/document`), shipment create/modal exports
(`/sales/shipments/document/create|/export`), act-for-editing get/qty/set
(`/protocol/act/invoice/get|set/edit/act/for/editing`), and the warehouse `isFromStorages` print flow.

### Partial
PZ doc (`/sales/get/document/pz`) — wired but dead/unreachable (Poland-only, ok for UA); DownloadDocuments
modal renders one doc only (no multi-doc for the bundled рахунок+накладна); ~~discount/percent gating uses
lifecycle 0||1 but legacy treats Packaged(2) as Packaging too~~ **(FIXED §12)**; `IsInvoice` not written on fetch.

### Row EXPANDER — MISSING (separate from documents)
The legacy sales rows had an **inline expander** (`SaleExpandItem`): expand a row → order-items list
(per-item discount) + transport services (Poland) + inline document download/TTN print. The console
`DataTable` has **no expandable-row support** and the grid has no inline expander. Order items are only
visible by opening the full `SaleEditorDrawer`; the eye-drawer (`SaleDetailsDrawer`) shows the
carrier/delivery change-history, not the order items. → genuine parity gap; needs DataTable
expandable-row support + a SaleExpandContent (order items + transport services).

### ✅ Resolved (2026-06-01, commits 9ee10d9 + this commit)
- **Row EXPANDER — DONE.** Added opt-in expandable rows to the shared `DataTable`
  (`renderExpandedRow`/`getRowCanExpand`/expand toggle column, backward-compatible — inactive unless
  `renderExpandedRow` is passed). `SaleExpandContent` reproduces `SaleExpandItem`: order items
  (code / name / orig-number / price / sum / qty) + per-item discount affordance gated by New/Packaging
  status and uniform-discount detection. Wired into `SalesUkrainePage` (`getRowCanExpand` = items>0).
- **Document menu — DONE.** `SaleDocumentsMenu` now reproduces the full legacy logic: Видаткова накладна
  (transporter+packaging), Лист на пакування (VAT), per-edit invoice/act-for-editing/shipment history +
  current Акт редагування (`/sales/get/shifted/document`), and Рахунок на оплату which **bundles** the
  Видаткова накладна (`InvoiceDocumentURL`/`PdfInvoiceDocumentURL`) when `IsAcceptedToPacking` OR the user
  holds an invoice role (Administrator/GBA/FinanceDirector/Accountant). Multi-doc modal renders all files.
- **VAT convert-to-invoice — DONE.** `SaleEditorDrawer.convertToInvoice` now branches on `IsVatSale`:
  VAT → `convertVatSaleAndGetPaymentDocument` (`POST /sales/update/get/payment/document`, FormData
  sale+file) and opens the returned рахунок; non-VAT → `/sales/update/file` as before. Lifecycle → Packaging(1).
- **Create-invoice-edit (Акт редагування) — DONE.** New `SaleEditDrawer`: per-item bill↔store qty grid
  (NumberInput, clamp bill+store ≤ Qty), bulk «Все в рахунок» / «Все на склад», `DoShift` →
  `shiftOrderItemsCurrent` (`POST /orders/items/shift/current` with the whole Sale; ShiftStatuses use the
  flat enum Bill=1/Store=0, no `$type` — confirmed against legacy entities). Menu trigger gated exactly
  like the legacy `moving` icon: `canEditSale` (= `UkraineAllActOfEdit_Change_PKEY`) + no merges + items>0
  — **no lifecycle gate** (legacy's lifecycle/ShiftStatus condition is on the *audit* `time_line_icon`,
  not the shift-edit icon; shift-edit is available on New «Рахунок» sales too). Title «Акт редагування
  рахунку» (New) / «…накладної» (else) — matches legacy `ActForEditingAnAccount`/`…ConsignmentNote`.
- **`ConfirmProcessing` approve — already present** in `warehouse-ukraine` (`approveEditingAct` →
  `/protocol/act/invoice/set/edit/act/for/editing`, EditingList approval queue). The per-sale audit-timeline
  duplicate entry point remains optional (low value, the warehouse queue is the primary).

---

## 10. Big functional parity audit — 8 domains, adversarially verified (run `wf_460cf529`, 2026-06-01)

Deep **functional** (not screen-level) legacy↔console diff across all non-WIP domains: sales-core,
sales-siblings, sales-analytics, clients, online-shop, products-customs, accounting, customs-warehouse.
21 agents; every High/Medium finding got an adversarial verifier against the legacy source.

**Result: the migration is in excellent shape.** Of ~13 High/Medium claims, **12 were REFUTED** with
concrete legacy evidence (mostly sales-vs-warehouse surface conflations or references to commented-out
legacy code), confirming the §1–§9 work closed the real gaps. Clients / sales-analytics / accounting:
**zero** findings. Notable refutations (kept here so they are not re-raised):
- *Invoice endpoint missing `isFromStorages`* — FALSE. Legacy segregates two endpoints: the sales
  dashboard uses `/sales/get/last/document` (NO `isFromStorages`), the warehouse uses
  `/sales/get/document?...&isFromStorages=true`. Console reproduces BOTH (`getSaleInvoiceDocument` vs
  `warehouse-ukraine/salesApi`). Adding the param would be a regression.
- *Act-protocol-edit missing `IsPrintedActProtocolEdit` toggle* — FALSE. That toggle lives only in the
  legacy **warehouse** view (already mirrored in `warehouse-ukraine/salesApi`); the sales `get/shifted/document`
  call is netId-only in legacy too.
- *`IsPrinted` write-on-print missing* — FALSE. The legacy sales-pivot write is **commented out**; the real
  `IsPrinted` write is warehouse-only.
- *sales-offers date filter should be ISO* — FALSE. Legacy `offers.pivot` sends `?from=${DateFromValue.toDateString()}` — console's `toDateString()` is faithful.
- *warehouse OrdersTab missing CarryOut/GetUp/ActReconciliationNew* — these are the **§1b documented
  not-migrated** placement actions (the underlying console action isn't built), not a regression.

### ✅ Built — discount editing now fully faithful (this commit)
The one CONFIRMED gap: the collapsed sales-row discount column let the user open the **sale-level**
discount modal (which overwrites **every** item's `OneTimeDiscount`) even when items had **differing
positive** per-item discounts — legacy showed a non-clickable average there and routed per-item editing
to the expander. Reproduced the legacy 3-branch logic on the collapsed row (`SalesUkrainePage` discount
cell): **(1)** uniform non-zero → clickable, opens sale-level modal (all items); **(2)** all-positive but
differing → **non-clickable average** (no clobber); **(3)** mixed → clickable «Знижка» for New, hidden for
Packaging. And made `SaleDiscountModal` accept an optional `orderItem` so the **expander's per-item**
discount click updates **only that item** (matching legacy `sale.discount.modal` `OnSave`: per-item when an
`OrderItem` is passed, all-items otherwise). tsc 0 / eslint 0.

---

## 11. Placement-header actions CarryOut + GetUp — BUILT (2026-06-01)

Closed two §1b not-migrated features on the warehouse placement editor
(`WarehouseUkraineOrderPlacementsPage`, warehouse-ukraine — non-WIP):

- **«Провести» (CarryOut)** — gated by `PlacementHeader_CarryOut_ordersUkrainePlacement_PKEY`,
  shown only when `!order.IsPlaced`. Confirm modal → `createProductIncomeFromDynamicPlacements` →
  `POST /products/incomes/new/supply/ukraine/dynamic?fromDate=&storageNetId=` with the supply order body
  carrying **`IsPlaced: true`** (full placement → creates the product income, order becomes placed). Reloads.
- **«Оприходувати» (GetUp)** — gated by `PlacementHeader_GetUp_ordersUkrainePlacement_PKEY`. Same endpoint,
  same confirm modal, but **`IsPlaced: false`** (partial placement — order stays open for further placements).

Faithful to legacy `placement.header.view.tsx` / `supply.ukraine.placement.view.tsx`
(`NewProductIncome(isFullPlaced)` → `createUkraineProductIncomeFomDynamicPlacementsAction`): same single
endpoint, the only difference is the `IsPlaced` flag, each behind an "AreYouSureToDoAction" confirm.
Added a «Дата оприходування» date input (legacy header `DateFromValue`, defaults to today) feeding
`fromDate`, and the selected storage feeding `storageNetId`. tsc 0 / eslint 0.

**Still deferred:** `ActReconciliationNew` (opens the full `NewActReconciliationView` reconciliation
creation sub-form — a larger build, left for when the act-reconciliation creation flow is migrated).

---

## 12. Discount gating — Packaged(2) treated as Packaging (§9 partial closed, 2026-06-01)

Legacy `SaleLifeCycleStatusConvertor.Parse` maps **both** `Packaging`(1) and `Packaged`(2) →
`'SaleLifeCyclePackaging'`, so legacy `IsNewOrPackagingStatus` is true for 0/1/2. The console's
`isNewOrPackagingStatus` only checked `0 || 1` — Packaged(2) sales lost the discount affordance.

- **`SalesUkrainePage.isNewOrPackagingStatus`** → now `0 || 1 || 2`, so the collapsed-row discount cell
  treats Packaged like Packaging (Branch 1 uniform clickable, Branch 2 average non-clickable, Branch 3
  add hidden for 1/2 — already correct).
- **`SaleExpandContent`** — corrected the per-item affordance to the exact legacy rule: existing per-item
  discount is clickable for **any** non-uniform sale (was gated to New/Packaging), and the empty
  «Знижка» add link shows **only for New(0)** (legacy hides the add for IsInvoice = Packaging/Packaged).
  Removed the now-unused local `isNewOrPackagingStatus`. tsc 0 / eslint 0.

---

## 13. ActReconciliationNew (placement «Інший товар / більша кількість») — drawer BUILT, wire pending (2026-06-01)

Despite the name, the legacy `NewActReconciliationView` (opened from the placement header) is an
**"add unordered / extra product"** form: it appends a `SupplyOrderUkraineItem` with `NotOrdered: true`
(Product + Qty + UnitPrice + NetWeight) to the supply order and saves via the SAME
`POST /supplies/ukraine/order/update` the console already uses (`updateSupplyOrderUkraine`). It also lists
existing `NotOrdered` items with a delete. It is **placement-only** (not reachable from the standalone
Act Reconciliations list) and does NOT hit any `/reconciliation/*` create endpoint.

Built (warehouse-ukraine, self-contained, tsc 0 / eslint 0):
- `api/orderPlacementsApi.ts` → `searchPlacementProducts` (`/products/search/vendorcode`).
- `placementsTypes.ts` → added `UnitPrice?` to `PlacementOrderItem`.
- `components/PlacementUnorderedProductsDrawer.tsx` → lists `NotOrdered` items (delete) + add-form
  (product search + Qty/Ціна/Вага → `NotOrdered:true` item → `updateSupplyOrderUkraine`). Validation
  = product selected && qty>0 (legacy). The console placement grid already filters `NotOrdered` items out,
  so these extras now have a home.

**Wire pending (the placement page is user-WIP — not touched to avoid clobbering uncommitted changes).**
To finish, add to `WarehouseUkraineOrderPlacementsPage`:
1. `import { PlacementUnorderedProductsDrawer } from '../components/PlacementUnorderedProductsDrawer'`
2. model: `const [unorderedOpen, setUnorderedOpen] = useValueState(false)` + expose `setOrder`,
   `unorderedOpen`, `setUnorderedOpen`; perm `const canActReconciliation =
   hasPermission('PlacementHeader_ActReconciliationNew_ordersUkrainePlacement_PKEY')`.
3. header button (when `!order.IsPlaced && canActReconciliation`):
   `<Button variant="light" onClick={() => model.setUnorderedOpen(true)}>{t('Інший товар / більша кількість')}</Button>`
4. render: `<PlacementUnorderedProductsDrawer order={model.order} opened={model.unorderedOpen}
   onClose={() => model.setUnorderedOpen(false)} onSaved={(updated) => { model.setOrder(updated); model.setUnorderedOpen(false) }} />`

---

## 14. Sales-tab exhaustive element audit + row/sub-row parity (run `wf_edeed1a3`, 2026-06-01)

73-agent element-by-element audit of the «Продажі» row + expander (every button/icon/checkbox/badge/
click/conditional). **0 high, 10 medium, 11 low confirmed**; ~55 claims refuted — notably the **row
selection checkbox IS present** (8/8 refuted), the **накладна/print buttons ARE present** (12/13
refuted), amounts/debt and action-icons all present. So the tab was in better shape than feared; the
real gaps were a cluster of visual indicators + client identity + sub-row detail.

### ✅ Built this commit (sales-ukraine — row + SaleExpandContent)
- **«Знак оклику» — will-not-ship red `!`** on the row when `IsVatSale && !IsAcceptedToPacking`
  (legacy sale.item.tsx:121-164). Clickable (→ onWillNotShip) when `ChangedToInvoice && canWillNotShip`,
  dimmed (opacity .4) otherwise, tooltip «Замовлення не буде відвантажено». The *action* was already in
  the menu; this restores the at-a-glance indicator.
- **Temporary-client `!` prefix** (`IsTemporaryClient`) + **Root/sub-client hierarchical name**
  («RootClient (sub-client)») with tooltip, on the client column (legacy sale.item.client.name.tsx).
  Added `IsTemporaryClient`/`RootClient` to `SalesUkraineClient`.
- **Expander sub-row**: item **Comment**, per-item **discount updater** (`DiscountUpdatedBy.LastName`),
  and **qty-overflow tint** (red-1 bg when `Qty !== OverLordQty`) (legacy sale.expand.row.tsx:14-20 /
  sale.expand.content.item.tsx). Added `DiscountUpdatedBy`/`Comment` to `SalesUkraineOrderItem`.

### Deferred / divergent (not built — reason)
- **Product code/name/orig clickable → product card** (medium): the console has no product-card modal
  feature at all — a cross-cutting feature, out of scope for this row pass.
- **SaleDateView as a separate modal** (divergent): console folds ShipmentDate→Packaged editing into
  `SaleDetailsDrawer` edit mode — acceptable.
- **Inline lock icon on row** (divergent): console keeps unlock in the actions menu — acceptable.
- **Region code on row**, **retail-client phone+name click → online shop**, **org select-all checkbox**
  (Mantine MultiSelect has none), **Ctrl+Insert new-sale shortcut**, **TTN button id attr** — all low/
  cosmetic, left as-is.

---

## 15. Sibling-tabs exhaustive element audit (run `wf_401a7766`, 2026-06-01)

123-agent element-by-element audit of the 6 sibling dashboard tabs (Оферти, Резерв кошика, Боржники,
Зацікавленість, Повернення, Рух товару клієнта), content + chrome each. **0 high, 2 medium, 12 low
confirmed**; most claims refuted — the tabs are faithful (present counts 23–59 per facet vs 0–4 gaps).

### ✅ Built
- **Повернення — returns grid: added «Код регіону» (`Client.RegionCode.Value`) + «Договір»
  (`ClientAgreement.Agreement.Name`) columns** at their legacy positions (after currency / after storage).
  Legacy `all.client.returns.view` had 13 cols incl. these two sortable lookups; console had 10.
- **Оферти — «Не опрацьовано клієнтом» badge** on the offer card for `OfferProcessingStatus===NotProcessed`
  (legacy offer.item.tsx:82-86) — previously only conveyed via the status-dot tooltip.

### Intentional / acceptable divergences (NOT changed)
- **Резерв кошика days-remaining**: console shows a colored semantic Badge + «Залишилось днів» label vs
  legacy bare number — a deliberate improvement (§5). Minor ±1-day boundary diff (`Math.trunc(ms)` vs
  dayjs `.diff('day')`) — negligible.
- **Рух товару / Боржники / Повернення**: «Експорт» (+IconDownload) vs legacy «Load» label; download-doc
  modal title «Документи» vs «LoadingSales»; returns delete/print folded into the actions menu; new-return
  uses a flat DataTable+checkbox vs legacy accordion — all acceptable console-pattern ports, no data loss.
- **Org MultiSelect select-all**: Mantine MultiSelect has no built-in select-all toggle — left as-is.
- **Ctrl+Insert / qty autofocus / page-header label**: minor UX, not ported.

---

## 16. Картка товару — clickable product in the sub-row (2026-06-01)

The §14 medium gap (legacy clickable product code/name → product card) is closed. New reusable
`features/products/components/ProductCardModal` fetches `getProductByNetId` and shows a compact card:
ShopImageGallery (by VendorCode) + code/name/orig-number/group, availability (UA / в дорозі / ПДВ /
перепродаж / браковані), prices (local + EUR), measure unit / weight / size / volume, description, notes,
plus an «Відкрити» link to `/products?netId=`. Wired into `SaleExpandContent`: the product code + name are
now clickable Anchors (stopPropagation) that open the card (legacy `OnOpenProductCart`). tsc/eslint clean
on the changed files.
