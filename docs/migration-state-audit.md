# Migrated State Audit

This audit tracks the current "verify before more migration" pass for already moved GBA console surfaces.
Scope is existing migrated UI only. New feature migration is intentionally paused for this pass.

## Guardrails

- Do not run build, TypeScript compile, or dev servers until the user explicitly approves it.
- Do not migrate Poland-specific surfaces in this phase. `POLAND_`, `Poland`, `poland`, Polish income/sales/warehouse routes stay deferred.
- Keep current behavior where the old app relied on backend state, but make empty/loading/error states explicit in the new UI.

## Fixed In This Pass

### Product detail

- Invalid `?panel=` values are now sanitized instead of leaving the page in an impossible panel state.
- Reservation API errors are visible in stock summary instead of silently looking like "no reserves".
- Product save/image upload success without response body now reloads the product card, so the UI does not stay stale.
- Edit payload now keeps existing child arrays instead of clearing unknown nested data during product update.
- Product edit now carries `DescriptionUA`, `NotesUA`, and nullable `Weight`.
- Product images now use stable row keys for main/delete actions, avoiding wrong-image updates when ids are missing.
- Remains, storage history, movement, and write-off panels now block invalid/missing `NetUid` and invalid date ranges before API calls.
- Storage location signed quantities no longer render broken `+-`/`--` signs.
- Write-off add/delete actions now respect loading and missing-id states, and upsert avoids duplicate rows when the backend returns an existing rule.

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
- Product placement import and returned-products modal errors now stay inside their modal context.
- Product placement/history "no storages" state takes priority over "select storage" validation.

### Clients, suppliers, organizations, users

- New/edit client `SupplierName` and `Manufacturer` are synchronized to avoid divergent producer/client data.
- Client and supplier active/inactive switches reconcile the current active filter and close stale selected rows.
- Organization services payment-task loading is guarded against stale async responses from older searches.
- Changing/clearing an organization clears previous payment-task state.
- Transporter list waits for transporter types before showing "not found/select type" empty states.
- User role detail panel no longer shows a role hidden by current filters.
- Organization client new sheet cannot close during save, matching edit behavior.
- `UserEditPage` missing `Box` import was fixed.

### Accounting and resources

- Accounting cash flow detail resolution now includes type `22` as `AccountingContainerPaymentTask`.
- Client resource pricing create/save is blocked until required support lookups are loaded.
- Client resource pricing validates selected currency and price type before save payload creation.

## Known Gaps To Keep Visible

These are not fixed in this pass because the user paused new migration and requested verification of already moved behavior first.

- Product write-off legacy had product/product-group mode and language variants. New panel currently covers product-level Ukrainian rules only.
- Product storage placement edit/bulk preview from the legacy `TotalQtyGroupView` is not migrated yet.
- Product detail legacy tabs such as original numbers, analogues, accessories, income, and outcome are not migrated yet.
- `/products/income/ukraine` is still placeholder-level and does not load the full old flow.
- Product remains movement history is not fully wired as a migrated workflow.
- Product storages bulk action preview is deferred.
- Product capitalizations create/import flows are deferred.
- `/sales-online-shop` remains read-only list/detail.
- Client new `perfect-client` and `pricing` steps are placeholders.
- Client edit tabs beyond general/contact/bank-details remain placeholders.
- Client resources map is unavailable.
- Client resource organization country is currently locked to Ukraine.
- TaxFree accounting operations remain unavailable.
- SAD accounting action awaits a dedicated panel.
- Transporter archive action is unavailable.

## Validation Performed

- Targeted ESLint on all changed React/TypeScript files: passed.
- `npx react-doctor@latest --verbose --diff`: passed with no error-level findings. Full scan still reports pre-existing warnings outside this focused state pass.
- Build/TypeScript compile/dev server: intentionally not run, per user instruction.
