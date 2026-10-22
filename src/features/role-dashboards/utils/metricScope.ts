import type { DashboardWorkspaceMetric, DashboardWorkspaceSummary } from '../types'

const expectedMetricKeys: Record<string, string[]> = {
  logistics: ['open-protocols', 'partially-placed', 'shipped-invoices', 'missing-documents', 'overdue-orders'],
  warehouse: ['receipts', 'receipt-qty', 'awaiting-placement', 'negative-stock', 'transfers'],
  accounting: ['cash-in', 'cash-out', 'income-documents', 'outcome-documents', 'reconciliation-differences'],
  finance: ['cash-in', 'cash-out', 'net-cash-flow', 'open-debts', 'overdue-debts'],
  executive: ['sales', 'sold-qty', 'available-qty', 'open-debts', 'returns'],
  driver: ['assigned', 'sent', 'pending'],
  client: ['sales', 'items', 'qty'],
}

export function hasCompleteMetricCoverage(summary: DashboardWorkspaceSummary): boolean {
  const expected = expectedMetricKeys[summary.workspace]
  return Boolean(expected?.length) && expected.every((key) =>
    summary.metrics.some((metric) => metric.key === key && metric.hasData && metric.coveragePercent === 100
      && (metric.timeBasis === 'current' || metric.timeBasis === 'period')),
  )
}

export function metricTimeLabel(metric: DashboardWorkspaceMetric): string {
  return metric.timeBasis === 'current' ? 'Поточний стан'
    : metric.timeBasis === 'period' ? 'За обраний період' : 'Період показника не визначено'
}

/** Only link counts whose destination supports exactly the same population and period. */
export function metricDrilldownRoute(summary: DashboardWorkspaceSummary, metric: DashboardWorkspaceMetric): string | undefined {
  if (summary.workspace !== 'warehouse' || metric.key !== 'transfers' || metric.timeBasis !== 'period' || !metric.hasData) return undefined
  const from = summary.from.slice(0, 10)
  const toExclusive = summary.to.slice(0, 10)
  if (!readDashboardTransferPeriod(new URLSearchParams({ dashboardFrom: from, dashboardToExclusive: toExclusive }))) return undefined
  return `/products/transfers?${new URLSearchParams({ dashboardFrom: from, dashboardToExclusive: toExclusive })}`
}

export function readDashboardTransferPeriod(params: URLSearchParams): { from: string; to: string } | null {
  const from = params.get('dashboardFrom') || ''
  const toExclusive = params.get('dashboardToExclusive') || ''
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  if (!validDate(from) || !validDate(toExclusive) || toExclusive <= from) return null
  const days = (Date.parse(`${toExclusive}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  if (days > 366) return null
  return { from, to: new Date(Date.parse(`${toExclusive}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) }
}
