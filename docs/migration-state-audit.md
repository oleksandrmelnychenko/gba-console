# Migrated State Audit

This audit tracks the current "verify before more migration" pass for already moved GBA console surfaces.
Scope is existing migrated UI only. New feature migration is intentionally paused for this pass.

## Guardrails

- Do not run build, TypeScript compile, or dev servers until the user explicitly approves it.
- Do not migrate Poland-specific surfaces in this phase. `POLAND_`, `Poland`, `poland`, Polish income/sales/warehouse routes stay deferred.
- Keep current behavior where the old app relied on backend state, but make empty/loading/error states explicit in the new UI.

## Fixed In This Pass

### Product detail

- `/products` now uses an inline legacy-style "Весь асортимент" carousel flow: vertical product drum, search/selection modes, selected mini-card, same-screen full product card, and visible action buttons. The table view and route jump on carousel selection were removed from this screen.
- Product deep links now resolve into the same `/products` carousel/card flow: `/products/:netId` redirects to `/products?netId=...`, and the query loads the selected product into the drum instead of a separate detail screen.
- `/products` carousel uses a single visible drum input for assortment lookup; legacy advanced search still runs internally with the default all-fields/name ordering without exposing separate filter/sort controls on the assortment screen.
- `/products` inline tabs now carry legacy product-card actions for original numbers, analogues, components, income, and outcome without navigating away from the selected carousel product.
- Original numbers can now be added, edited, marked as main, deleted when not main, and bulk-loaded from the legacy upload document flow.
- Analogues and components now support legacy remove actions, file upload document flows, and same-screen related-product selection through the assortment carousel, with upload access behind `Product_Entire_Assortment_Product_Upload_Document_Btn_PKEY`.
- `/products` assortment toolbar now exposes the legacy non-PL upload actions for analogues, components, and original numbers through the same upload endpoints used by the inline tabs.
- `/products` assortment toolbar now supports the legacy product-file upload endpoint with non-PL column mapping, Add/Update/Delete modes, file selection, and optional price column mappings.
- Product income/outcome tabs now use the dedicated legacy endpoints (`/consignments/info/income/filtered`, `/consignments/info/outcome/filtered`) instead of generic movement filtering, show the legacy column set, keep local-date defaults, and expose export document download links.
- Product detail total availability now prefers `ProductAvailabilities.Amount` when available, while related analogue/component availability keeps the old separate formula for each tab.
- Product stock summary storage rows with placement data now open an inline placement editor with grouped view, edit/save/cancel/add-new states, quantity-sum validation, and bulk save through `/products/placements/storage/update`.
- Product action buttons and drawer content now respect the legacy permission keys for balances, edit, product movement, write-off rules, and image add/delete actions.
- Original-number actions now support scoped keyboard handling (`Insert`, `F2`, `Delete`, `Esc`) without firing while focus is inside inputs/buttons.
- Product upload-document modals now support keyboard handling (`Esc`, `Ctrl/Cmd+Enter`) in the new modal flow.
- Product images now open a full-view zoom modal from the inline product card, product detail hero image, and image-management panel.
- Product images now fall back to the legacy shop image path based on vendor code when API image fields are empty.
- `/products/income/ukraine` now renders the migrated product income document flow instead of an empty placeholder.
- Invalid `?panel=` values are now sanitized instead of leaving the page in an impossible panel state.
- Reservation API errors are visible in stock summary instead of silently looking like "no reserves".
- Product save/image upload success without response body now reloads the product card, so the UI does not stay stale.
- Edit payload now keeps existing child arrays instead of clearing unknown nested data during product update.
- Product edit now carries `DescriptionUA`, `NotesUA`, and nullable `Weight`.
- Product images now use stable row keys for main/delete actions, avoiding wrong-image updates when ids are missing.
- Product images now preview newly selected files before save, keep deleted images visible as pending deletion, and provide a local cancel/reset action.
- Remains, storage history, movement, and write-off panels now block invalid/missing `NetUid` and invalid date ranges before API calls.
- Storage location signed quantities no longer render broken `+-`/`--` signs.
- Write-off add/delete actions now respect loading and missing-id states, and upsert avoids duplicate rows when the backend returns an existing rule.
- Write-off rules now support product-group scope with group selection and product/group reloads.
- Product income document overview now has explicit detail loading/error state, and batch remainings open as a separate row option instead of rendering as a stale extra table in the overview.
- Product income documents now re-check capitalization linkage after the detail endpoint returns, so capitalization rows that are absent from the list payload can still load their overview.

### Product inventory and movement screens

- Batch/product drawers in remains reset when filters/tabs change, avoiding stale details under a different filter.
- Remains export is disabled while an export is already running.
- Storage and supplier resource errors are split, so one lookup no longer stomps or keeps stale error state for the other.
- Product transfer detail drawer is protected against stale async responses after close or row change.
- Product transfer refresh reloads both transfers and storage metadata.
- Product transfer load-more is guarded by request key and offset, avoiding old pages appended after filter/page-size changes.
- Product capitalization detail drawer is protected against stale async responses.
- Product income document remaining-items drawer is protected against stale async responses.
- Product income document row state now respects `Deleted` documents and canceled sale returns.
- Product income source links no longer point to routes still marked `todo` in the matrix.
- Product storages load-more is guarded against stale append after storage/search/page-size changes.
- Product storages now carry the legacy selection flow: checkbox/select-all state, permission-gated Preview drawer with editable `ChangedQty` validation, and permission-gated row action modal.
- Product storages actions now post the legacy non-PL operations for transfer (`/products/transfers/new`), write-off (`/orders/depreciated/new`), and single return-to-supplier (`/supplies/returns/new` with available-consignment selection).
- Product placement import and returned-products modal errors now stay inside their modal context.
- Product placement/history "no storages" state takes priority over "select storage" validation.
- Product remains by product rows now expose row-level movement history with date filters, loading/error/empty states, and `/consignments/info/movement/specific`.

### Clients, suppliers, organizations, users

- New/edit client `SupplierName` and `Manufacturer` are synchronized to avoid divergent producer/client data.
- Client and supplier active/inactive switches reconcile the current active filter and close stale selected rows.
- Organization services payment-task loading is guarded against stale async responses from older searches.
- Changing/clearing an organization clears previous payment-task state.
- Transporter list waits for transporter types before showing "not found/select type" empty states.
- Transporter archive status now uses the legacy hidden-transporter endpoint for `Архів`/`Усі` filters instead of filtering only the active response.
- User role detail panel no longer shows a role hidden by current filters.
- Organization client new sheet cannot close during save, matching edit behavior.
- `UserEditPage` missing `Box` import was fixed.

### Accounting and resources

- Accounting cash flow detail resolution now includes type `22` as `AccountingContainerPaymentTask`.
- Client resource pricing create/save is blocked until required support lookups are loaded.
- Client resource pricing validates selected currency and price type before save payload creation.

## Known Gaps To Keep Visible

These are not fixed in this pass because the user paused new migration and requested verification of already moved behavior first.

- Product permissions now cover the main old action gates, but deeper module-level permission parity still needs spot checks as each nested panel is finished.
- `/products` assortment toolbar still lacks storage-location upload shortcut and not-passed product correction.
- Product recommendation forecast action/chart is not migrated.
- Product capitalizations create/import flows are deferred.
- `/sales-online-shop` remains read-only list/detail.
- Client new `perfect-client` and `pricing` steps are placeholders.
- Client edit tabs beyond general/contact/bank-details remain placeholders.
- Client resources map is unavailable.
- Client resource organization country is currently locked to Ukraine.
- TaxFree accounting operations remain unavailable.
- SAD accounting action awaits a dedicated panel.

## Validation Performed

- Targeted ESLint on changed product React/TypeScript files: passed.
- `npx tsc -b --pretty false`: passed.
- `npm run build`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 6 files / 34 tests.
- `npx react-doctor@latest --verbose --diff`: passed with no error-level findings. Score API was unreachable; remaining 3 warnings are architecture/style warnings (`prefer-useReducer`, `no-giant-component`, `no-many-boolean-props`).
