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
