# Explicit Goods classification in Console

## Scope

Prepared on the deployed Console base `f1367f2d024085cd75541f8b79b6e400aeac32e3` in an isolated worktree. No browser, API, SQL, Docker or 1C connection was opened during implementation. This UI change does not enable server execution gates.

In **1С синхронізація → Щоденна → FENIX**, an authenticated user with the existing `Synchronization.Run` permission can explicitly refresh classification for the one selected completed calendar day. The date range must have identical start/end dates, interpreted in `Europe/Kyiv`. The server independently admits the day, target and shared source lease.

The action uses one POST to `/data/sync/online-shop-seo/report-goods/refresh-day` with `closedKyivDay`, `forAmg=false` and `type=Sales`. The existing API client supplies credentials and CSRF protection. Its existing unauthorized-session refresh remains in place; this component performs no automatic retry after network failure, timeout, refusal or lost response. The client deadline is 110 seconds, beyond the API's 100-second actor ask.

## Boundaries

- Mounting or selecting the panel sends no classification request.
- The action does not call native Daily/session import, allocate a native sync operation ID, invoke native progress mutations, or change synchronization session state. While classification is pending, local native start controls are blocked; the server lease remains the execution authority. Existing independent status polling is preserved and can reflect the held global server lock.
- Closing the panel, changing the selected day/world/mode/user, or losing permission aborts the client request and discards late responses. Client cancellation does not prove cancellation or rollback of a server operation. An unknown result asks the user to inspect synchronization state and the report before another explicit attempt.
- Responses require the exact day, numeric advisory statuses `0..3`, reasons `0..11`, bounded integer fact/product/time counters, zero source writes and false whole-catalogue/source-sales-day/XLS/overall-readiness flags. Accepted completion requires a complete current native census and a coherent empty/published/current classification summary.
- Successful completion tells the user to refresh the report. No report cache or saved report filters are modified. There is no claim that all reports are ready, no historical XLS parity claim, and no automatic ordinary sync activation.

## Offline verification

Focused Vitest covers the response/calendar boundaries, one-click request, disabled/busy/refused responses, permission loss, scope/user changes, unknown/wrong-day responses, timeout and no native Daily/session request. The existing native report synchronization boundary test is included.

Actual local results: **63/63 tests passed** (62 new cases and the existing native-report boundary), scoped ESLint passed, TypeScript and Vite production build passed. React Doctor stayed **89/100**, with the same twelve pre-existing findings and none in the new control. The build retains the existing large vendor-chunk warning; the tests retain Node's localStorage experimental warning. No live rendering or execution is certified by these results.

The full relevant `src/features/reports` and `src/features/header-actions` regression suites also passed: **3,592 tests in 179 files**, zero failures, in 76.04 seconds. The final compiled runtime bytes were preserved for Root packaging without another rebuild.

Run from the isolated worktree:

```sh
rtk npm test -- src/features/header-actions/components/FenixGoodsDayRefreshPanel.test.tsx src/features/header-actions/components/SyncControl.native-reports.test.tsx
rtk proxy npx --offline eslint src/features/header-actions/goodsDayRefresh.ts src/features/header-actions/components/FenixGoodsDayRefreshPanel.tsx src/features/header-actions/components/FenixGoodsDayRefreshPanel.test.tsx src/features/header-actions/components/SyncControl.tsx
rtk npm run build
rtk proxy env npm_config_offline=true npx react-doctor@latest --verbose --diff
```

Server activation, live API verification, browser rendering and deployment require separate Root integration. Existing server gates stay closed until that admission is completed.
