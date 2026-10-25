# Sales, products and reports: performance verification

Scope: product details, sale creation/cart, sales registry, report workspace and preview.
Baseline source: `9e2a0589`. Measurements use deterministic fixtures, not production traffic.

## Changes and checks

| Path | Previous work | Current work / regression check |
| --- | --- | --- |
| Registry search, 100 sales, six characters | 1,200 reads of order data before the debounced request | Zero order reads while typing; one debounced request remains |
| Fresh registry response with equal records | New object identities render every row again | Complete JSON snapshots are compared; equal rows and pages reuse their references |
| Cart, 100 positions, one changed quantity in fresh JSON | All cards render | One card renders; unchanged items/products retain references |
| Report preview, 50 × 60 cells | Pending/error pagination state rebuilds the displayed table | No rebuilding of 3,000 unchanged cells; successful pagination still replaces the page |
| Product details with pending reserves | Product and prices wait for both requests | Product displays immediately after its request; reserves have a separate loading state |
| Report catalogue dialogs | Closed dialogs mount; implementation code loads with the workspace | Dialogs mount and load when opened; visited published tabs retain state and skip unrelated renders |

Snapshot sharing checks every field, including lifecycle, locking and other action data. It does not compare only displayed columns. Unknown/class instances use the fresh value. It neither mutates API responses nor changes mutation, recovery or retry rules.

Product requests share an abort signal; switching products or unmounting cancels both, and late results cannot replace the current card. Loading reserves display a dash and an explicit loading message, not a fabricated zero. Reserve failure leaves the product usable. Refresh retries both requests.

The preview's row-count formatting now lives in `reportCountPresentation.ts`. Importing the display component no longer loads the workbook configuration through this helper; this also removes the circular initialization error observed when loading the standalone preview in native ESM.

## Browser observations

Chromium, Vite development server, React Profiler, 1440 px viewport. These are local diagnostic observations, not production latency targets or CI timing assertions. Initial mounts, delayed internal updates, CPU contention and development overhead affect timings; deterministic work-count tests are the regression gates.

- Updating one cart position: typically 33–41 ms before, 3.0–3.6 ms after (100 positions; seven actions; baseline had additional internal commits and an outlier).
- Re-rendering a parent around an unchanged 3,000-cell preview: median of the last seven measured updates 8.9 ms before; 0 ms reported for all seven updates after memoization. Initial rendering still has a cost.
- Registry search plus a fresh equal 100-sale response: summed Profiler durations 268.8 ms before, 34.2 ms after. One request in both cases. Largest commit 226 ms before, 10.3 ms after. The fixture intentionally returns 100 rows despite the default request limit of 20 to exercise the larger grid.
- With the reserve response held pending, the old full product page did not display its price; the new page displayed `42,75` and the reserve loading state. Completing the response updated the reserve quantity.
- Cart keyboard navigation (`End`, then `Enter`) selected position 100. Cart, preview, registry and product page had `documentElement.scrollWidth === clientWidth` at both 1440 and 390 px.
- No fixture API request is forwarded to a server; unrecognized requests fail locally.

## Bundle observation

Production Vite build, before and after deferring report dialogs and published workspaces:

| Asset | Before | After |
| --- | ---: | ---: |
| `ReportsStocksPage` JavaScript | 810.54 kB | 598.72 kB |
| Same asset, gzip | 198.97 kB | 160.24 kB |

This is a reduction of about 26% raw / 19% gzip for that asset, not the whole application. Shared dependencies and feature-specific chunks still load when needed. Existing large vendor chunks remain outside this optimization.

## Reproduce

Run `npm run dev -- --host 127.0.0.1 --port 5193`, then open `/tests/browser/sales-report-performance.html` in Chromium. The fixture renders actual components with 100 cart items, 100 sales and a 50 × 60 preview. Use its buttons to change one position, update only the surrounding panel, switch surfaces, or finish the pending reserve request. Inspect `window.performanceFixture.samples`, `requests` and `selected` for profiler entries, captured API requests and the selected cart position. This HTML is a development fixture, not a production build entry.

Focused automated checks:

```sh
npx vitest run src/features/products/useProductDetailData.test.tsx src/features/products/pages/ProductDetailPage.loading.test.tsx src/features/sales-ukraine/saleSnapshot.test.ts src/features/sales-ukraine/components/new-sale-wizard/WizardCartCards.performance.test.tsx src/features/sales-ukraine/pages/salesUkraineGridPerf.test.tsx src/features/reports/pages/ReportPreviewPages.test.tsx src/features/reports/pages/ReportsStocksPage.renderScope.test.tsx --maxWorkers=2
```

Use the existing product, sales and report suites for permissions, keyboard navigation, cart mutations/recovery, report totals, formatting and dialog workflows. Validate TypeScript, ESLint and the production build as well. No backend throughput, live production response time or deployment claim follows from these measurements.

Verification results for this pass: the broad product/sales/report run passed 673 files and 8,181 tests; the report-workspace/snapshot rerun passed 76 files and 436 tests; the final focused regression run passed nine files and 26 tests. The final wizard integration rerun passed four tests. These runs overlap and should not be added as unique test counts. TypeScript, scoped ESLint and the Vite production build passed. The final browser session recorded zero console errors.

## Follow-up: wizard product requests and summary renders

Wizard prices now publish independently of reservations, and stock publishes independently of nearest-supply information. A dispatched stock/supply read survives closing the details panel and is reused if it is reopened while that read is pending. Completed snapshots still refresh on a later opening. Product/context changes, explicit invalidation, retry and unmount retire pending reads; closing before the 240 ms focus delay sends no detail request.

The shared product summary is memoized. Wizard image/details callbacks retain stable identities while dispatching to the current product and keyboard state. A deterministic regression test performs 20 stock-row selection updates with zero summary recomputations; price and action changes still update the summary. Before the change, the same test observed 20 recomputations.

The browser fixture now includes the actual product-selection step. With reservation and supply responses held pending, Chromium displayed the price and stock. Closing and reopening details kept the totals at one stock request and one supply request. The wizard details surface had no document overflow at 1440 and 390 px; the session recorded zero console errors. All API responses are local fixtures, so this is not a live-server latency or end-to-end sale-creation claim.

Validation: 84 product/wizard test files, 765 tests passed, including delayed responses, cancellation, retry, context changes and render isolation. TypeScript, scoped ESLint and the production Vite build passed. Existing bundle-size warnings remain. To reproduce the browser scenario, choose `Майстер продажу`, search `TEST-001`, open `Деталі`, then close/reopen it before using `Завершити постачання`. Use `Завершити резерви майстра` to release the independent reservation response. Inspect `window.performanceFixture.requests` for request counts.

## Follow-up: search, analogues and components

Repeated settled search input now preserves the current request and results when the trimmed query is unchanged. Reapplying the current search/sort settings does not restart the search. An explicit retry still refreshes it. Search and analogue requests use the latest callbacks without treating callback identity changes as request invalidation. Cached analogue restoration preserves state identity when the visible list is already current; the existing context invalidation and stale-response cancellation remain in place.

Related-product rows are memoized with stable action forwarding. In a 30-row regression fixture, moving focus renders two rows instead of all 30; changing only an action callback renders no rows, while the action invokes its latest handler. Updating one product's price renders that row. Component product arrays and set-quantity lookups are memoized, and shared price/quantity presentation lives in `WizardRelatedProductMetrics`. Components still come directly from the selected product payload and require no separate request. The main search picker already debounces input and memoizes its rows; those mechanisms are retained.

Validation: 85 product/wizard test files and 770 tests passed, along with TypeScript, scoped ESLint and the production build. The new request/render regressions failed before the changes and passed afterward. Chromium showed one search request after changing `TEST` to ` TEST ` and one analogue request through related-product selection. The fixture displays two analogues and two components with prices and set quantities; clicking either list and pressing ArrowDown selects its second row. It forwards keyboard events through the same dispatcher as the wizard shell. Desktop (1440 px) and mobile (390 px) checks showed no document overflow. Requests remain mocked, with no sale mutations or live-service performance claim.

## Follow-up: recommendations and cross-sell

`useWizardCrossSellProducts` owns cross-sell request lifetime and scope. A pending read is reused across closing/reopening the modal; a later opening after completion fetches fresh agreement prices and availability. Changing client, agreement or seed retires the request and immediately hides the previous products. Missing client/agreement prevents a request. Unmount aborts a pending read even while closed. Failed reads can be retried by reopening. Cart exclusions remain local and do not trigger another request.

`useRecommendationsData` owns recommendation data and selection state. The seed-product card and ranked recommendations load independently: a slow or failed supplementary seed lookup no longer holds back the list. A late seed response preserves selected products. Request scope changes reset data, selection and image preview; changing the seed also remounts the panel's pending UI state. Existing agreement lineage validation, permissions and feedback API behavior remain unchanged.

`RecommendationProducts` contains the presentation and memoized selectable cards. Selecting one product in a 30-card test recomputes only its card; changing only callbacks recomputes none and still invokes the latest handler. Cross-sell cards similarly retain stable pick callbacks. Price formatting reuses a formatter. Image failure state is associated with its URL, allowing a replacement image to load.

The product-search hook already prevents overlapping client-recommendation actions; a deferred-response regression now verifies repeated activation sends one request. Four cross-sell lifecycle/render tests failed against the previous implementation and passed after the extraction. The broad clients/wizard/offers run passed 117 files and 907 tests; final focused checks additionally cover image replacement and retry after failure. TypeScript, scoped ESLint and the production build passed (existing large-chunk warnings remain).

Chromium fixture checks: a recommendation could be selected before the seed response, and remained selected afterward; closing/reopening pending cross-sell produced one request, and picking the first card returned `reco-0`. Both views had no document overflow at 1440 and 390 px and no console errors. Choose `Рекомендації клієнта` or `Крос-продажі` in the fixture; release delayed responses with `window.performanceFixture.finishRecommendationSeed()` or `window.performanceFixture.finishCrossSell()`. Responses include the real recommendation metadata contract. The cross-sell pick is recorded locally; no sale or feedback mutation is sent.

## Follow-up: product-step and delivery-step carts

`getWizardCartTotals` now provides the common quantity/EUR/local calculation for the cart sheet, its table and the delivery footer. It sums server row amounts and rounds once, preserving discounts and the existing local-currency source selection. The sheet passes its memoized totals to the table, so switching between cards and table does not calculate them twice.

`useWizardCartItems` sorts by creation date only when the source item array changes. Updating sale/header fields retains the sorted array and row identities. Empty carts also retain a stable array. On delivery, the order summary and footer are memoized; editing delivery fields no longer re-traverses the cart. An integration regression reproduced 20 quantity reads for 20 comment changes before the fix and zero afterward, while changing a cart position still updates quantity and amounts. Additional tests cover stable sorting, missing timestamps, numeric edge cases, local-currency mode and shared totals across the sheet/table.

Validation: all 67 wizard test files and 599 tests passed; TypeScript, scoped ESLint and the production build passed. Existing large-chunk build warnings remain. The browser fixture now mounts the real product and delivery steps with a 100-position cart. Cards, table and delivery showed 100 units / EUR 1,000 / UAH 42,000. A local fixture update to one position changed both steps to 101 / EUR 1,010 / UAH 42,420. Editing city and comment kept the recorded request count at seven. The cart cards, mobile table and delivery checks had no document overflow at 390 px; cart cards and delivery also passed at 1440 px. No browser console errors were recorded. All requests and cart updates in this fixture remain local; no sale was submitted.

## Follow-up: cart editing and split selection

The shared table resolves each row's CSS class before its memoized row boundary. Moving selection in the cart editor now updates the previously selected and newly selected rows without rendering every cell in either cart table. The regression fixture observed 30 cell renders before this change and two afterward; recreating an equivalent selection callback renders none. The public table API and selected-row styling remain unchanged.

`useWizardCartAvailability` owns the fresh availability read used by both add and edit quantity preparation. Changing agreement, sale identity or VAT mode, or unmounting the controller aborts the pending read. A retired response cannot open a quantity dialog or trigger the fallback intended for real load failures, even if the transport ignores cancellation. Unrelated sale/comment updates preserve the pending request. Each later edit still reads fresh, uncached stock. The existing mutation lock prevents duplicate preparation while a request is pending. Split-item quantity preparation already uses its locally reserved quantity, so it needs no stock query; extraction, restoration and durable recovery keep their existing sequencing.

Validation: 77 wizard/shared-table test files and 690 tests passed, including split/recovery coverage. The six initial request/render regressions failed before implementation and passed afterward. TypeScript, scoped ESLint and the production build passed; existing large-chunk warnings remain. Chromium with a 100-position cart sent one availability request for two Enter presses while its response was held pending, then displayed available quantity 7 (current 1 plus stock 6). A separate local split fixture showed 70 current and 30 split positions, navigated across their boundary, and retained all positions after hiding/reopening the split table. Navigation and toggling added no requests (six recorded before and after). Both 1440 px and 390 px split-editor checks had no document overflow or browser console errors. The fixture uses local responses and synthetic split state; no live position was split or saved.
