# QA Desk BUG-1276: horizontal scroll in product card outcome table

Product-card UI issue, separate from the 1C report migration.

## Issue evidence

- QA Desk `BUG-1276` requests a bottom horizontal scrollbar on the `Розхід` table in a product card at `/products`, so users can reach all columns. Its only attachment is `Screenshot_358.png` (`e157ff2fce4ab255cf52296da8aff7dd2c4362def822051feb5cdb121d8d73e9`). The screenshot shows the right edge of the table clipped and no visible bottom scrollbar.
- The task notes say an audit-only release was recorded at `2026-09-24T10:57:46Z`; the task status in QA Desk is still `blocked`. The completed QA worker run reports no code change for BUG-1276.
- The DEV console image already contained commit `89db9fba` before this screenshot was uploaded. Thus the screenshot shows that commit's minimum-width change did not make a bottom scrollbar visibly available. The earlier conclusion that BUG-1276 was already fixed was wrong.

## Implemented fix

- `src/features/products/pages/ProductsPage.tsx` wraps only `ProductOutcomeMovementsGrid` with `ProductOutcomeHorizontalScroll`. The original `minWidth={1900}` and native scrolling remain.
- The new component measures the actual scroll area and renders an explicit orange range control directly below it whenever the table exceeds the viewport. It stays synchronized with native scrolling, responds to keyboard and pointer input, and updates on table or viewport resize. The control disappears when all columns fit.
- No API, database, report, or 1C code changed.

## Verification and limit

- The browser fixture mounts the same `DataTable`, outcome CSS, and new control with one row. Playwright with Chrome passed **2/2**: at 1560 px the control is visible immediately below the table, a pointer click reveals `Кількість`, dragging the thumb back moves the table, and `End` returns it to the right; at 2200 px no redundant control appears. A Chromium screenshot confirmed the orange track and thumb below the one-row table.
- The focused `ProductsPage.incomeColumns.test.tsx` suite passed **9/9**; production `npm run build` and `git diff --check` passed.
- The authenticated DEV `/products` page opened through a local browser session before deployment, but its product list remained in `Завантаження`, so the exact product-card scenario was not reproduced there.

## DEV deployment

The fix was copied alone into an isolated checkout and committed as
`8fbca819bd57c8294f6041f15d6af3d66890729f`. Its Docker build passed;
the prior DEV image is retained as `gba-console:pre-bug1276-20260924`, and the
new image is pinned as `gba-console:bug1276-8fbca81`. The
`gba-dev-gba-console-1` container now runs the image labeled with that exact
commit and reports `healthy`. Local `/build.json` returned
`2026.09.24.2052`; the external `/products` route returned HTTP 200 after
deployment. This proves the new bundle is served, while authenticated visual
verification of the actual product card remains open because the earlier
product list did not finish loading in the browser session.
