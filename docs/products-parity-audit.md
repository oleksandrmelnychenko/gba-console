# Products (Already-Migrated) — Parity Audit

> **STATUS: PARITY CLOSED (2026-05-29).** All gaps below were closed across product slices on branch `clients/full-migration`: capitalization create/import, income-documents drill-downs, product-groups polish, transfers+storages, placements/history/remains/income-ukraine/availabilities, the product detail card, and a final 2-gap pass (shop-CDN thumbnail gallery + group root-picker search). A final 11-screen completeness re-audit returned **0 residual gaps**. Each slice verified with tsc + eslint + build + tests.
>
> Accepted deferrals (not gaps): carousel search/sort dropdowns (deliberately removed), infinite-scroll→Load-more (console convention), Poland surfaces (SynonymsPL, write-off 'pl', income.poland), cross-module overviews/creates (orders/ukraine-act/supply modules), new-product-image upload UI (dead legacy action), recommendation forecast chart (no charting lib; legacy hardcodes a stale asOfDate — data helper added). The pre-closure gap inventory below is retained as the baseline.

Audit date: 2026-05-29. Source of truth: legacy `gba_client`. Target: `gba_console`.
12-screen fan-out (inventory → console-code audit → adversarial re-verification).

Status: **missing** = no console counterpart · **partial** = present but incomplete · *deferred* = Poland/disabled-in-legacy.

## Totals

- ✅ done: **372** · 🟡 partial: **51** · ❌ missing: **71** · ⏸️ deferred: **14**

**Not migrated (partial+missing): ~122.**

## Accepted intentional deviations (NOT gaps — do not revert)

- `/products` carousel search-mode + sort-mode dropdowns: deliberately removed (single-input assortment; see migration-state-audit.md and the 'Refine products assortment carousel' commit). Advanced search runs internally with all-fields/name defaults.
- Infinite-scroll-on-bottom replaced by explicit 'Load more' across list screens (console-wide convention).
- Poland surfaces (SynonymsPL, write-off 'pl' locale, *.income.poland*) deferred.
- Cross-module endpoints reachable elsewhere (manual create-transfer, SupplyOrderUkraine overview, create-from-reconciliation/packing-list).

## Detail by screen

### Products list + assortment carousel (/products)

`done 33 · partial 7 · missing 5 · deferred 2`

**Missing:**
- Simple product search endpoint (legacy/secondary /products/search)
- Search product by vendor code endpoint (refetch after upload)
- Detail — recommendation forecast chart (EditClientChartModal)
- Income consignment select-list endpoint (placement editor)

**Partial:**
- Search-mode selector (lookup) — VendorCode/OriginalNumber/Size/Name/Description/All — Enum/mode mapping is fully migrated in the type/options layer and passed as &mode= to the API, but the user-facing search-mode dropdown is missing — search hard
- Sort-mode selector (lookup) — ProductName/Top/VendorCode — Enum + &sortMode= wiring present, but no user-facing sort dropdown.
- Get product groups on screen mount (lookup) — Write-off panel obtains groups per-product (getProductGroupsByProductNetId) instead; the consuming feature still has a group source.
- Load menu — popover toolbar (permission-gated) — Only 3 of legacy's 5 entries. StorageLocation_btn (placement upload) and NotPassedProduct (return products) are NOT in this menu — they live on the separate /pr
- Detail action — Specification (history) panel — Console shows the embedded specs only; the full supply-specification-history view with its own fetch is not reproduced.
- Consignment remainings panel + endpoint — Endpoint + core data done; several legacy columns (Code, Naming, InvoiceNetUnitPrice, TotalManagementGrossPrice, TotalAccountingGrossPrice, Currency, Organizati
- Product edit panel — editable fields + save — Legacy fields present. Missing vs legacy: SynonymsPL (Poland-deferred, acceptable), disabled MainOriginalNumber field + embedded EditCodesProductModalView popov
- Product movements panel — filters, types, print, grid — Missing vs legacy: the 13 individual movement-type checkboxes + reset (console always queries all types); the Load→print document button; and several grid colum
- Consignment movement filtered + print endpoints — Filtered fetch migrated; movement print/export and 'specific' variant are missing from the products screen.
- Product write-off rules panel — create/list/delete — Region/RuleLocale options limited to 'uk' only (writeOffLocaleOptions ProductDetailPage.tsx:155; formatRuleLocale knows 'pl' line 2250 but it is not selectable)
- Detail — main product image + thumbnail gallery + zoom — Correction: shop base URL DOES match the legacy ImgsShopUrl host (verified). Remaining gap: legacy product.image.view.tsx uses ZoomImageView with Zoom={2.5} (li
- Per-storage placement inline editor (StorageAvailability) — Confirmed missing the legacy income-consignment select-list per storage: console editor has no income getAllSelect call, so placement rows cannot be tied to a s
- Tab: Analogues (grid + navigate + delete + styling) — Missing legacy row color styling by Top=x9/IsForSale/IsForZeroSale on analogue rows (getProductRowToneClass ProductsPage.tsx:2777-2793 applied to carousel rows 
- Tab: Accessories (Components) (grid + navigate + delete + sets) — Missing legacy Setting/Box icon distinguishing component vs set, and row color styling. isProductSet flag and quantity/unit preserved. Core done.

### Product detail/edit card (tabs: original numbers, analogues, components, income, outcome, images, stock, placements, write-off) — route /products/:netId

`done 46 · partial 11 · missing 4 · deferred 2`

**Missing:**
- Per-field audit History panel (ProductDescriptionAuditTemplate)
- Endpoint: New product image (/products/new/upload)
- Endpoint: Get audit entities by id (per-field history)
- Endpoint: Export movement print document
- Endpoint: Get consignment remainings by product income

**Partial:**
- Tab: General Specification (GeneralSpecification) — Pivot sub-tabs flattened; per-field audit history and SynonymsPL not migrated.
- General info field: Synonyms (SynonymsPL + SynonymsUA, editable) — SynonymsPL is the Poland synonyms field — deferred surface, not migrated.
- Tab: Specification (customs) Codes (SpecificationCodes) — No Current/History separation, no AddedBy/Created authorship column.
- Analogues grid column: VendorCode (clickable -> carousel) — VendorCode click migrated; red/blue/green row color-coding not applied to related cards.
- Components grid columns (VendorCode/Name/OriginalNumber/Icon/Quantity/MeasureUnit/PackingStandard/Склад Укр./Remove) — Component-vs-set icon and row color-coding not migrated.
- Tab: Product Movement (ProductMovement) — Per-type checkbox filters + reset and movement print export not migrated.
- Product Movement grid columns — 8 of legacy's 16 columns missing; no edited-row highlighting.
- Tab: Product Write-Off Rules (ProductWriteOffRule) — Functionally complete except Poland 'pl' region option deferred (uk-only).
- Consignment remainings panel (Залишки по партіям) — 5 columns omitted (TotalNetPrice/AccountingGrossPrice/Currency/Organization/Weight); by-income variant not wired (see separate endpoint item).
- Lookup: Languages / regions for write-off rule locale — uk-only; pl deferred.

### Product groups list + detail (route /product-groups)

`done 33 · partial 11 · missing 5 · deferred 0`

**Missing:**
- Product Groups list: column 'Description'
- Info card: 'Cancel' action (reset edits, no backend call)
- Endpoint: get product by id (Products-tab redirect)
- Permission: create product group button (Product_Groups_ADDBtn_PKEY)

**Partial:**
- Product Groups list: search/filter input — VERIFIED gap. Missing legacy 300ms setTimeout debounce (products.groups.grid.view.tsx:154-162) — grep for debounce/setTimeout/useDebounce in src/features/produc
- Product Groups list: totals footer (TotalFilteredQty rows.length + GeneralQty totalProductGroupsQty) — Legacy rendered a dedicated two-metric footer block (TotalFilteredQty=rows.length, GeneralQty=totalProductGroupsQty; grid.view:183-198). Console surfaces both m
- Create new product group (button, Product_Groups_ADDBtn_PKEY gated) — VERIFIED gap. Button NOT permission-gated. Legacy wraps it in <PermissionCheck permissionKey='Product_Groups_ADDBtn_PKEY'> (grid.view:137-139), the only permiss
- Product Group info card (editable detail form with isEdited gating) — VERIFIED gap. No isEdited tracking: Save button disabled only when !formProductGroup (ProductGroupDetailPage.tsx:247). grep isEdited/isDirty/dirty/hasChanges in
- Info card: 'Save' action (POST /products/groups/with/content/update) — VERIFIED gap. Save not gated by isEdited — always enabled when a form is loaded (disabled only when !formProductGroup, line 247). Legacy showed a disabled Save 
- Detail content: 'AllProducts' tab — VERIFIED gap. Row-click cross-screen redirect to the Products screen is MISSING. ProductGroupProductsPanel has NO onRowClick (DataTable at 228-241 has none) and
- Sub-groups tab: data grid + infinite scroll (server paging) — VERIFIED. Explicit 'Load more' button instead of legacy InfiniteGridLoader auto-fetch-on-scroll-at-bottom (product.group.sub.groups.tsx:108-126,196-208 OnScroll
- Sub-groups tab: filter input — VERIFIED gap. Missing legacy 300ms debounce (product.group.sub.groups.tsx:147-158) — fires on each keystroke. Offset reset to 0 (loadSubGroups(0,false)).
- Sub-groups tab: page-size (LimitDownloads) dropdown — VERIFIED gap. Legacy RangePageQtyElements = [15,25,50,100,150,200] (grid.view:21) with default rangePage.rangeProductSubGroups, persisted in redux via setRangeP
- Products tab: data grid + infinite scroll (server paging) — VERIFIED. Explicit 'Load more' button instead of legacy auto-infinite-scroll-on-bottom (product.group.products.tsx:113-131,201-213). Paging/append preserved; au
- Products tab: filter input — VERIFIED gap. Missing legacy 300ms debounce (product.group.products.tsx:151-162) — fires on each keystroke.
- Products tab: page-size (LimitDownloads) dropdown — VERIFIED gap. Legacy options [15,25,50,100,150,200], default/persisted via rangePage.rangeProductProductGroups (product.group.products.tsx:90), persisted with s

### Product income documents (route /products/income/documents)

`done 26 · partial 4 · missing 9 · deferred 0`

**Missing:**
- Row-click options modal (SwitchModal)
- ProductIncomeActReconciliationView panel
- ProductCapitalizationPanelView panel
- ProductCapitalization 'Load' (print/export) button
- ProductIncomeSupplyOrderUkraineOverview panel
- ProductIncomeSaleReturnView panel
- Endpoint: product income info by id (GET /products/income/info/get)
- Endpoint: product capitalization get (GET /products/capitalizations/get)
- Endpoint: product capitalization print/export (GET /products/capitalizations/document/export)

**Partial:**
- Column: SpecificationDate — Legacy declares a grid column SpecificationDate (width 150, DateTimeColumnFormatter). Console exposes the value only in the drawer, not as a registry column. Co
- Action: View document (type-routed overview) — Legacy onOverview opened four distinct DISPLAY_PANEL overviews or deep-link redirects per first-item kind (PackingList->supply-orders/product-placement redirect
- ConsignmentRemainingsPanel (slide-in panel) — CORRECTION: legacy has 15 columns (not 14 as first-pass stated); exactly 3 are absent in console (GrossPrice, AccountingGrossPrice, ProductIncomeNumber). Reset-
- Sale-return / SupplyOrderUkraine overview 'Load' (print/export) button — The export endpoint + download-link modal are present and reachable for every document type. Partial because it is a generic Export button on the unified drawer

### Product income Ukraine (route /products/income/ukraine)

`done 7 · partial 0 · missing 1 · deferred 4`

**Missing:**
- Page title 'PlacingProductsToUkraineStore'

### Product transfers (route /products/transfers)

`done 41 · partial 2 · missing 9 · deferred 0`

**Missing:**
- List column: Index (row number)
- Detail panel item column: Index
- Detail panel action: Load (export/print document)
- Download documents modal (shared) for transfer export
- Endpoint: export/print transfer document
- Endpoint (NOT reachable from this screen): create transfer (manual)
- Endpoint (NOT reachable from this screen): create transfer from reconciliation item(s)
- Endpoint (NOT reachable from this screen): create transfer from packing list

**Partial:**
- Infinite scroll / virtual load (pagination) — Functionally equivalent pagination, but the legacy auto-on-scroll behavior is replaced by an explicit button + page-size selector.
- Detail panel item row context menu: product placements/locations — Same underlying placement data (StorageNumber-RowNumber-CellNumber + Qty) is shown, but as an always-visible column rather than the legacy right-click affordanc

### Product remains (storage incomes pivot: batches/products) — route /products/storages/incomes

`done 62 · partial 3 · missing 0 · deferred 2`

**Partial:**
- Batches footer: totals row (11 labeled EUR + local UAH/PLN + Accounting totals) — Missing ALL local-currency (UAH/PLN) totals and ALL accounting-valued totals, plus the EUR 'General' (TotalAmount) figure. Console surfaces only filtered-EUR su
- Products filter: Storage select (legacy: NO 'All' option, required) — Net effect (cannot load products without a concrete storage) preserved, but the affordance differs: legacy omits the option entirely, console allows selecting '
- Products footer: totals row (legacy omits plain ForSelectedRange UAH/PLN line) — Missing ~7 of 9 legacy totals lines. The legacy products-vs-batches difference (products omits plain ForSelectedRange Local) is moot since console renders neith

### Product storages (availability + bulk actions) — route /products/storages

`done 25 · partial 4 · missing 3 · deferred 1`

**Missing:**
- FromDate date picker (filter)
- FromTo (to-date) date picker (filter)
- Grid column: Index

**Partial:**
- Search box (product filter) — Verified missing: legacy _searchSubject$.debounceTime(200) (product.storages.view.tsx:111-124) — console refetches synchronously per keystroke (grep 'debounce' 
- Load product availability (paged, infinite scroll) — Verified: legacy auto-triggered next page on scroll-near-bottom (OnScroll/OnVirtualLoad, product.storages.view.tsx:212-228, legacy _limit=20). Console requires 
- Single transfer (Shift) — NewProductTransferView — DOWNGRADED from first-pass 'done' to 'partial'. Behavioral divergence in payload Organization: legacy single transfer sets productTransfer.Organization = Select
- Reset selection / cleanup on unmount and on success — Legacy componentUnmount (product.storages.view.tsx:130-137) explicitly cleared SUCCESS_ALL_STORAGES_BY_STATUS, SUCCESS_ORGANISTTIONS, resetSelectedProductAvaila

### Product placements (route /products/placements)

`done 30 · partial 4 · missing 1 · deferred 0`

**Missing:**
- Grid column: Index (#)

**Partial:**
- Search box (VendorCode / value search) — MISSING BOTH legacy debounces: (1) the 200ms RxJS input debounce in the view (product.placements.view.tsx:127-141 _searchSubject$.debounceTime(200)), AND (2) th
- Placements data grid — MISSING the infinite-scroll virtual load (legacy OnScroll/OnVirtualLoad product.placements.view.tsx:313-328 appends ProductPlacementStorage and offset += limit 
- Pagination control — Legacy used antd <Pagination> with numbered page jump + showSizeChanger, total from ProductPlacementStorage[0].TotalRowsQty (product.placements.view.tsx:514-533
- Action: Not passed product (open/re-open returns modal) — DOWNGRADED from done. Auto-open covers the immediate post-upload flow, but once the modal is closed there is no console re-entry point and returnedRows are not 

### Product Placement History (route /products/history)

`done 18 · partial 3 · missing 2 · deferred 1`

**Missing:**
- Column: Index (#)
- Infinite-scroll virtual load (dormant)

**Partial:**
- Search field (vendor code / value) — Functional parity on the value param and page reset; missing both the 200ms input debounce and the 300ms epic debounce, so every typed character issues a fetch.
- Column: Placing (Qty) with per-storage placement chips — Storage:Amount summary present as static text; clickable chip that opens the detail popover is gone (see next item).
- Placement detail popover (StorageAvailabilityHistory) — Grouped Storage/Row/Shelf + Qty preserved as inline text; income-document-number column and the read-only popover table/inputs are not migrated. Income number i

### Product capitalizations (route /products/capitalization)

`done 28 · partial 1 · missing 32 · deferred 2`

**Missing:**
- List column: Index
- Action: Open 'New capitalization' panel (+ button)
- New Product Capitalization panel (create document)
- New panel field: Comment
- New panel field: FromDate
- New panel field: Organisation (dropdown)
- New panel field: Storage (dropdown)
- New panel field: VendorCode product autocomplete (item entry)
- New panel field: Quantity (item entry)
- New panel field: Gross weight per unit (item entry)
- New panel field: Unit price (item entry)
- New panel action: Create / add line item
- New panel action: Carry out / submit (create document)
- New panel action: Open 'Import from Excel' upload modal
- New panel items grid: editable cells
- New panel items column: Index
- New panel items column: VendorCode
- New panel items column: Name
- New panel items column: Qty (editable)
- New panel items column: UnitPrice (editable)
- New panel items column: Weight (editable)
- New panel items column: Delete (row delete)
- Backend: create capitalization
- Backend: search products by vendor code
- Backend: list organizations
- Backend: list storages filtered by organization
- Import-from-Excel upload modal (ProductCapitalizationUploadModal)
- Upload modal field: file picker
- Upload modal field: VendorCode column number
- Upload modal field: Qty column number
- Upload modal field: Start row (From)
- Upload modal field: End row (To)
- Upload modal field: Weight column + per-item checkbox
- Upload modal field: Price column + per-item checkbox
- Upload modal action: Load (parse items from file)
- Backend: parse capitalization items from file
- MissingVendorCodes modal (ProductCapitalizationMissingItemsModal)
- Detail panel items column: Index

**Partial:**
- Infinite scroll / virtual paging — limit/offset query params match legacy, but interaction model differs: legacy appends on scroll-to-bottom (with re-apply-sort, view lines 70-78); console uses d

### Product consignment availabilities (route /products/consignments/availabilities)

`done 23 · partial 1 · missing 0 · deferred 0`

**Partial:**
- Storage filter dropdown — Behavior (auto-select first, re-fetch on change) faithful; only option label format diverges (drops Organization.Name suffix that legacy AND sibling console scr
