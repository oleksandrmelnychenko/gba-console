import { describe, expect, it } from 'vitest'
import { normalizeMetricComparison } from './metricComparison'
import { normalizeDashboardWorkspaceSummary } from './dashboardWorkspacesApi'

const current = { from: '2026-10-24', to: '2026-10-27', value: 150, hasData: true, timeBasis: 'period' }
const comparison = { From: '2026-10-21T00:00:00', To: '2026-10-24T00:00:00', Value: 100, Delta: 50, DeltaPercent: 50, UnknownReason: '' }
describe('equal-duration metric comparisons', () => {
  it('accepts adjacent exclusive calendar periods across the DST transition', () => {
    expect(normalizeMetricComparison(comparison, current)).toEqual({ from: '2026-10-21', to: '2026-10-24', value: 100, delta: 50, deltaPercent: 50, unknownReason: '' })
  })
  it('keeps an old API without comparisons unchanged', () => {
    expect(normalizeMetricComparison(undefined, current)).toBeUndefined()
  })
  it.each([
    { From: '2026-10-20' }, { To: '2026-10-25' }, { From: '2026-02-30' },
  ])('does not manufacture a comparison from mismatched periods %o', change => {
    expect(normalizeMetricComparison({ ...comparison, ...change }, current)).toMatchObject({ value: null, delta: null, deltaPercent: null, unknownReason: 'Період порівняння не підтверджено' })
  })
  it('never presents a percent against a zero denominator, including malformed non-null server percent', () => {
    expect(normalizeMetricComparison({ ...comparison, Value: 0, Delta: 150, DeltaPercent: 100 }, current)).toMatchObject({ value: 0, delta: 150, deltaPercent: null })
  })
  it('retains known previous data but suppresses change when the current source is unknown', () => {
    expect(normalizeMetricComparison(comparison, { ...current, hasData: false })).toMatchObject({ value: 100, delta: null, deltaPercent: null, unknownReason: 'Недостатньо даних для порівняння' })
  })
  it.each([null, undefined, '0', Infinity])('does not coerce missing or invalid previous value %s into zero', Value => {
    expect(normalizeMetricComparison({ ...comparison, Value, UnknownReason: 'Історична собівартість відсутня' }, current)).toMatchObject({ value: null, delta: null, deltaPercent: null, unknownReason: 'Історична собівартість відсутня' })
  })
  it('does not treat current debt snapshots as period comparisons', () => {
    expect(normalizeMetricComparison(comparison, { ...current, timeBasis: 'current' })?.delta).toBeNull()
  })
  it('normalizes camelCase wire data through the full summary parser', () => {
    const summary = normalizeDashboardWorkspaceSummary({ from: current.from, to: current.to, metrics: [{ key: 'recognized-sales', label: 'Продажі', value: 150, hasData: true, timeBasis: 'period', comparison: { from: '2026-10-21', to: '2026-10-24', value: 100, delta: 50, deltaPercent: 50, unknownReason: '' } }] }, 'executive', { from: current.from, toExclusive: current.to })
    expect(summary.metrics[0].comparison?.delta).toBe(50)
  })
})
