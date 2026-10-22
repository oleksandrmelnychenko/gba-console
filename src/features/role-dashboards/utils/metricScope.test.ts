import { describe, expect, it } from 'vitest'
import { hasCompleteMetricCoverage, metricDrilldownRoute, readDashboardTransferPeriod } from './metricScope'
import type { DashboardWorkspaceMetric, DashboardWorkspaceSummary } from '../types'

const metric: DashboardWorkspaceMetric = { key: 'transfers', label: 'Переміщень', value: 3, hasData: true, coveragePercent: 100, tone: 'neutral', unit: 'count', timeBasis: 'period' }
const summary: DashboardWorkspaceSummary = { workspace: 'warehouse', from: '2026-10-24', to: '2026-10-27', generatedAtUtc: '', cacheTtlSeconds: 30, dataFreshness: 'live', metrics: [metric] }

describe('metric scope', () => {
  it('uses an exclusive dashboard end and an inclusive register end across DST', () => {
    const route = metricDrilldownRoute(summary, metric)!
    expect(route).toBe('/products/transfers?dashboardFrom=2026-10-24&dashboardToExclusive=2026-10-27')
    expect(readDashboardTransferPeriod(new URL(route, 'https://console.test').searchParams)).toEqual({ from: '2026-10-24', to: '2026-10-26' })
  })
  it.each(['2026-02-30', '2026-13-01', '', '2026-10-24'])('rejects invalid or empty exclusive end %s', (end) => {
    expect(readDashboardTransferPeriod(new URLSearchParams({ dashboardFrom: '2026-10-24', dashboardToExclusive: end }))).toBeNull()
  })
  it('does not turn a generic register route into a reconciled KPI drilldown', () => {
    expect(metricDrilldownRoute(summary, { ...metric, key: 'negative-stock', route: '/warehouse/ukraine' })).toBeUndefined()
    expect(metricDrilldownRoute(summary, { ...metric, timeBasis: 'unknown' })).toBeUndefined()
  })
  it('requires every expected metric to have complete data before an all-clear state', () => {
    const complete = { ...summary, metrics: ['receipts', 'receipt-qty', 'awaiting-placement', 'negative-stock', 'transfers'].map((key) => ({ ...metric, key, value: 0 })) }
    expect(hasCompleteMetricCoverage(complete)).toBe(true)
    expect(hasCompleteMetricCoverage(summary)).toBe(false)
    expect(hasCompleteMetricCoverage({ ...complete, metrics: complete.metrics.map((m) => m.key === 'receipts' ? { ...m, coveragePercent: 80 } : m) })).toBe(false)
    expect(hasCompleteMetricCoverage({ ...complete, metrics: complete.metrics.map((m) => m.key === 'receipts' ? { ...m, hasData: false } : m) })).toBe(false)
  })
})
