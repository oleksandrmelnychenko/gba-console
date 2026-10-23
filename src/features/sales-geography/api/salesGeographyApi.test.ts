import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { geographySummary } from '../testFixtures'
import { getSalesGeography } from './salesGeographyApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
beforeEach(() => { request.mockReset() })

describe('geography summary request', () => {
  it.each(['all', 12, 24, 36] as const)('passes selected period %s without inventing browser dates', async period => {
    request.mockResolvedValue(geographySummary())
    const signal = new AbortController().signal
    await getSalesGeography({ metric: 'sales', ...(period === 'all' ? { period } : { months: period }) }, signal)
    expect(request).toHaveBeenCalledWith('/sales/geography/summary', { query: { metric: 'sales', ...(period === 'all' ? { period } : { months: period }) }, signal })
  })
  it('does not pass a sales period to current debt', async () => {
    request.mockResolvedValue(geographySummary('debt'))
    await getSalesGeography({ metric: 'debt', months: 36, from: '2020-01-01', to: '2020-02-01' })
    expect(request).toHaveBeenCalledWith('/sales/geography/summary', { query: { metric: 'debt' }, signal: undefined })
  })
  it('preserves inclusive explicit boundaries', async () => {
    request.mockResolvedValue(geographySummary())
    await getSalesGeography({ from: '2025-01-01', to: '2026-10-23' })
    expect(request).toHaveBeenCalledWith('/sales/geography/summary', { query: { metric: 'sales', months: 12, from: '2025-01-01', to: '2026-10-23' }, signal: undefined })
  })
  it('propagates server failures', async () => {
    request.mockRejectedValue(new Error('HTTP 503'))
    await expect(getSalesGeography()).rejects.toThrow('HTTP 503')
  })
})

describe('geography summary contract', () => {
  it('preserves cents, zero and signed return totals', async () => {
    const summary = geographySummary()
    summary.Rows[0] = { ...summary.Rows[0], ValueEur: -1.4, KnownValueEur: -1.4 }
    summary.Rows[1] = { ...summary.Rows[1], ValueEur: 0, KnownValueEur: 0 }
    summary.TotalEur = summary.KnownTotalEur = -1.4
    request.mockResolvedValue(summary)
    expect(await getSalesGeography()).toEqual(summary)
  })
  it('preserves an unknown full total and a partial known amount', async () => {
    const summary = geographySummary()
    summary.Rows[0] = { ...summary.Rows[0], RegionCode: null, ValueEur: null, UnresolvedAmountCount: 2 }
    summary.TotalEur = null
    summary.UnresolvedAmountCount = 2
    request.mockResolvedValue(summary)
    expect(await getSalesGeography()).toEqual(summary)
  })
  it('accepts empty confirmed results, without claiming import completeness', async () => {
    const summary = { ...geographySummary(), Rows: [], TotalEur: 0, KnownTotalEur: 0, ClientCount: 0, AvailableFrom: null, LatestDocumentDate: null }
    request.mockResolvedValue(summary)
    expect(await getSalesGeography()).toEqual(summary)
  })
  it.each([
    ['array instead of summary', () => []],
    ['missing total', s => ({ ...s, TotalEur: undefined })],
    ['numeric string', s => ({ ...s, KnownTotalEur: '2.8' })],
    ['nonfinite amount', s => ({ ...s, KnownTotalEur: Infinity })],
    ['wrong currency', s => ({ ...s, Currency: 'UAH' })],
    ['wrong metric', s => ({ ...s, Metric: 'debt' })],
    ['wrong time zone', s => ({ ...s, TimeZone: 'UTC' })],
    ['wrong basis', s => ({ ...s, AmountBasis: 'orders-created' })],
    ['missing completeness', s => ({ ...s, ImportCompletenessConfirmed: undefined })],
    ['invalid calendar day', s => ({ ...s, From: '2025-02-30' })],
    ['reversed dates', s => ({ ...s, From: '2026-10-24' })],
    ['invalid UTC time', s => ({ ...s, AsOfUtc: '2026-10-23' })],
    ['inconsistent known total', s => ({ ...s, KnownTotalEur: 3, TotalEur: 3 })],
    ['inconsistent client total', s => ({ ...s, ClientCount: 4 })],
    ['unknown masquerading as zero', s => ({ ...s, TotalEur: 0, UnresolvedAmountCount: 1 })],
    ['missing rows', s => ({ ...s, Rows: null })],
    ['blank region code', s => ({ ...s, Rows: [{ ...s.Rows[0], RegionCode: ' ' }, s.Rows[1]] })],
    ['duplicate normalized region', s => ({ ...s, Rows: [s.Rows[0], { ...s.Rows[1], RegionCode: ' pa ' }] })],
    ['unnormalized Crimea alias', s => ({ ...s, Rows: [{ ...s.Rows[0], RegionCode: '200' }, s.Rows[1]] })],
    ['missing row amount', s => ({ ...s, Rows: [{ ...s.Rows[0], ValueEur: undefined }, s.Rows[1]] })],
    ['negative client count', s => ({ ...s, Rows: [{ ...s.Rows[0], ClientCount: -1 }, s.Rows[1]] })],
  ] satisfies Array<[string, (s: ReturnType<typeof geographySummary>) => unknown]>)('rejects %s instead of showing zero', async (_label, change) => {
    request.mockResolvedValue(change(geographySummary()))
    await expect(getSalesGeography()).rejects.toThrow('Некоректні дані')
  })
  it('rejects a negative current debt', async () => {
    const summary = geographySummary('debt')
    summary.Rows = [{ ...summary.Rows[0], ValueEur: -1, KnownValueEur: -1 }]
    summary.TotalEur = summary.KnownTotalEur = -1
    summary.ClientCount = 2
    request.mockResolvedValue(summary)
    await expect(getSalesGeography({ metric: 'debt' })).rejects.toThrow('Некоректні дані')
  })
})
