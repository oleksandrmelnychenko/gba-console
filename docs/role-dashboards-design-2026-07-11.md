# Role dashboards: release design

Date: 2026-07-11  
Scope: GBA Console and gba-server, Ukraine flows. Polish dashboards are explicitly out of scope.

## Goal

Every operational role lands on a useful dashboard for its work. A GBA user can open every dashboard from one selector, while ordinary users can only open dashboards granted to their role.

This is not an impersonation feature. Selecting another dashboard changes the read-only analytical workspace; mutations still use the current user's identity and permissions.

## Current-state findings

- `/dashboard` is currently a static list of links, filtered by navigation grants.
- Sales manager and head-of-sales dashboards already exist and use live NBA data.
- Buyer analytics already exist in the procurement dashboard/cockpit.
- The database has multiple role rows with the same `UserRoleType`. In particular, `WarehouseManager`, `SalesAnalytic`, and `Storekeeper` all use type `0`. Dashboard routing therefore must use the role ID first and type only as a fallback.
- The legacy `GET /totals/dashboard/get` cannot be reused for release: on dev it returned HTTP 400 after 32.6 seconds.
- The legacy currency-register state endpoint also returned HTTP 400 after about 30 seconds.
- `GET /totals/dashboard/grouped/payments/get` returned in 0.81 seconds, but all values for the checked period were zero. Its business correctness must be audited before reuse.

## Dashboard catalog

| Key | Roles | Primary purpose |
| --- | --- | --- |
| `sales-manager` | `SalesAnalytic` | Personal sales plan, work queue, clients at risk, debts, next actions |
| `sales-head` | `HeadSalesAnalytic` | Department plan, team load, live tasks, escalations, manager drilldown |
| `buyer` | `PurchaseAnalytic` | Replenishment priorities, supplier work queue, budget cart, arrivals |
| `buyer-head` | `HeadPurchaseAnalytic` | Purchasing plan, budget, supplier risk, stock coverage, team exceptions |
| `logistics` | `Logistic` | Shipment pipeline, missing documents, overdue stages, blocked receipts |
| `warehouse` | `WarehouseManager`, `Storekeeper`, `Логіст склад` | Inbound/outbound queue, placements, discrepancies, transfers, returns |
| `accounting` | `Accountant` | Cash movements, unpaid documents, reconciliations, VAT and register state |
| `finance` | `FinanceDirector` | Liquidity, receivables/payables, cash flow, margin and currency exposure |
| `executive` | `TopManager` | Revenue, gross profit, margin, stock, cash, debt, returns and department health |
| `system` | `Administrator` | Synchronization, dead letters, API health, AI fleet, permissions and audit |
| `driver` | `Driver` | Assigned shipments, route/status, missing documents and completion queue |
| `client` | `ClientUa` | Own orders, shipment status, debt and documents; never company-wide data |
| `gba` | `GBA` | System workspace plus access to every dashboard above |

Polish roles (`PolishLogistic`, `HeadPolishLogistic`) remain hidden until the Poland scope is explicitly resumed.

## GBA experience

- The main menu contains one `Дашборди` entry, not one entry per role.
- `/dashboard` contains a dashboard selector only for the GBA role.
- The selector groups dashboards by `Продажі`, `Закупівлі`, `Логістика і склад`, `Фінанси`, `Керівництво`, and `Система`.
- The selected dashboard is reflected in `?view=<key>` so links are shareable.
- The last selected dashboard is remembered locally, but an invalid or revoked key falls back to `gba`.
- Every dashboard clearly shows the viewed role and the current data period. There is no visual implication that GBA is impersonating another user.

## Common layout

1. Compact command bar: dashboard selector (GBA only), date range, period presets, refresh, last-update status.
2. KPI strip: 4-6 comparable metrics with formula tooltips and data coverage.
3. Main workspace: trends/comparisons plus the role's prioritized work queue.
4. Exception rail: overdue, blocked, inconsistent, or failed records.
5. Quick actions: links to the existing operational screens, filtered when possible.

All dashboards use a shared date range with presets: today, 7 days, 30 days, current month, quarter, year, custom. Dates are interpreted in `Europe/Kyiv`; the API uses an inclusive `from` and exclusive `to` boundary.

## Metric dictionary

The server owns formulas. The frontend only formats returned values.

- `net_revenue`: completed sales excluding VAT, discounts applied, minus accepted returns in the selected period.
- `gross_profit`: `net_revenue - recognized_cogs`.
- `gross_margin_pct`: `gross_profit / net_revenue * 100`; null when revenue is zero.
- `cash_inflow` / `cash_outflow`: posted payment movements, not invoices.
- `receivables`: open customer debt at period end; overdue is a separate subset.
- `payables`: open supplier obligations at period end.
- `inventory_value`: available non-defective stock multiplied by its traceable cost. Missing cost is reported as coverage, never silently treated as zero.
- `stock_coverage_days`: projected days until depletion using the agreed demand model.
- `return_rate_pct`: accepted returned quantity or value divided by shipped quantity or value, with the basis stated in the DTO.
- `work_queue_count`: open actionable records after role and status filters.

Every money metric carries `currency`, `value`, `source`, and `coverage_pct`. EUR and UAH are separate values, not labels applied to the same number.

## API model

### Entitlement catalog

`GET /api/v1/uk/dashboards/workspaces/catalog`

The server resolves the current user from the JWT and returns only allowed workspaces:

```json
{
  "defaultWorkspace": "sales-manager",
  "canSwitchWorkspace": false,
  "workspaces": [
    { "key": "sales-manager", "name": "Продажі", "group": "Продажі" }
  ]
}
```

For GBA, `canSwitchWorkspace` is true and the catalog contains every in-scope workspace. The client cannot grant itself access by changing `view`.

### Domain summaries

Existing typed APIs remain authoritative for sales and procurement. New endpoints are added only for missing domains:

- `GET /dashboards/warehouse/summary`
- `GET /dashboards/logistics/summary`
- `GET /dashboards/accounting/summary`
- `GET /dashboards/finance/summary`
- `GET /dashboards/executive/summary`
- `GET /dashboards/system/summary`
- `GET /dashboards/driver/summary`
- `GET /dashboards/client/summary`

Common query: `from`, `to`, optional `compareFrom`, `compareTo`. Summary DTOs contain `asOf`, `dataFreshness`, `kpis`, `series`, `queueSummary`, and `exceptions`. Detailed queues use separate paginated endpoints; summary endpoints never return full entities or unlimited collections.

## Security

- Entitlement is enforced server-side using the actual `UserRole.ID`; `UserRoleType` is only a fallback for legacy rows.
- GBA can read all dashboard aggregates but does not gain mutation rights from the selected workspace.
- Client and driver dashboards are always scoped to the current principal.
- Cross-role requests return 403. Unknown workspace keys return 404.
- Dashboard responses contain DTOs only; no EF navigation graphs.
- Audit log records GBA dashboard selection only when sensitive drilldown data is requested, not for every selector change.

## Realtime

- Reuse the sales cockpit hub for sales task changes.
- Add `/hubs/dashboards` for domain invalidation events.
- Events contain `{ workspace, scopes, occurredAt }`, not full business payloads.
- The client invalidates/refetches only the affected section and deduplicates bursts within 500 ms.
- Polling fallback: queues 30 seconds, operational summaries 60 seconds, financial/executive summaries 5 minutes.

## Caching and performance

- Work queues: no shared cache or at most 10-15 seconds; always paginated.
- Operational KPI summaries: 30-60 seconds, keyed by workspace, period, organization, and role scope.
- Historical series: 5 minutes.
- Financial period-end aggregates: 5 minutes with explicit invalidation after sync/payment mutations.
- Never cache product availability as a long-lived dashboard aggregate.
- Release targets: warm p95 below 500 ms, cold p95 below 1.5 s, no request above 3 s for the supported period limits.

## Implementation sequence

1. Add role ID to the auth contract; implement the server-side workspace catalog and entitlement tests.
2. Replace the static `/dashboard` page with the shared role-dashboard shell and GBA selector.
3. Extract existing sales manager/head and buyer dashboards into embeddable workspace components without changing their calculations.
4. Implement warehouse/logistics summaries, then accounting/finance, then executive/system/driver/client summaries with focused SQL and query-plan checks.
5. Add the dashboard SignalR invalidation hub and polling fallback.
6. Add the single `Дашборди` navigation item and grants; GBA receives all workspace catalog entries.
7. Validate each role with API contract tests, SQL fixture calculations, Playwright desktop/mobile flows, and a GBA cross-workspace access matrix.

## Release gates

- Every active non-Polish role resolves to exactly one default dashboard.
- GBA sees every in-scope dashboard in the selector.
- A normal role cannot open another workspace by editing the URL.
- All displayed financial formulas match SQL fixtures and show data coverage.
- Date presets and custom ranges use Kyiv boundaries consistently.
- Realtime task changes appear without a full-page reload; polling takes over after hub failure.
- Empty data, partial data, stale data, loading, and failed states are visibly distinct.
- No dashboard depends on the legacy 30-second `totals/dashboard` endpoints.
