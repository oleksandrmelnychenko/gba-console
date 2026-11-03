import wire from '../payables-wire.testData.json'
import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { payablesBucket, payablesRows, payablesSnapshot, scopedPayablesSnapshot, scopedPayablesRows } from '../payablesTestData'
import type { PayablesRowsRequest } from '../payablesTypes'
import { getPayablesRows, getPayablesSnapshot, normalizePayablesRows, normalizePayablesSnapshot } from './dashboardPayablesApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const request: PayablesRowsRequest = { workspace: 'finance', asOfDate: '2026-11-02', currencyCode: 'USD', offset: 0, limit: 50 }

describe('payables GBA document contract', () => {
  it('accepts the real .NET serializer output', () => {
    const snapshot = normalizePayablesSnapshot(wire.snapshot)
    expect(snapshot.asOfDate).toBe('2026-11-02')
    expect(snapshot.buckets[0]).toMatchObject({ currencyCode: 'UAH', payable: 1527, advance: 40, goodsRowCount: 1, serviceRowCount: 1, unknownRowCount: 0 })
    const rows = normalizePayablesRows(wire.rows, { ...request, currencyCode: 'UAH' })
    expect(rows.aggregate).toEqual({ signedBalance: -1487, payable: 1527, advance: 40 })
    expect(rows.rows.map(row => row.partyKind)).toEqual([2, 3])
  })

  it('preserves currencies, gross debt and advances', () => {
    expect(normalizePayablesSnapshot(payablesSnapshot()).buckets[0]).toMatchObject({ payable: 100, advance: 20, signedBalance: -80 })
  })

  it.each(['asOfDate', 'currencyCode', 'offset', 'limit'] as const)('rejects a rows response for a different %s', key => {
    expect(() => normalizePayablesRows({ ...payablesRows(), [key]: key === 'offset' || key === 'limit' ? 99 : 'different' }, request)).toThrow()
  })

  it('rejects dropped rows, duplicate identities, reversed sign and amounts on an unconfirmed agreement', () => {
    const data = payablesRows()
    expect(() => normalizePayablesRows({ ...data, rows: data.rows.slice(0, 1) }, request)).toThrow()
    expect(() => normalizePayablesRows({ ...data, rows: [data.rows[0], data.rows[0]] }, request)).toThrow()
    expect(() => normalizePayablesRows({ ...data, rows: [{ ...data.rows[0], payable: 0, advance: 100 }, data.rows[1]] }, request)).toThrow()
    expect(() => normalizePayablesRows({ ...data, rows: [{ ...data.rows[0], known: false }, data.rows[1]] }, request)).toThrow()
    expect(() => normalizePayablesRows({ ...data, rows: [{ ...data.rows[0], partyKind: 1 }, data.rows[1]] }, request)).toThrow()
  })

  it('rejects duplicated currencies, inconsistent counts and malformed dates', () => {
    const snapshot = payablesSnapshot()
    expect(() => normalizePayablesSnapshot({ ...snapshot, buckets: [payablesBucket(), payablesBucket()] })).toThrow()
    expect(() => normalizePayablesSnapshot({ ...snapshot, buckets: [payablesBucket({ goodsRowCount: 5 })] })).toThrow()
    expect(() => normalizePayablesSnapshot({ ...snapshot, buckets: [payablesBucket({ unknownRowCount: 3 })] })).toThrow()
    expect(() => normalizePayablesSnapshot({ ...snapshot, buckets: [payablesBucket({ currencyCode: '' })] })).toThrow()
    expect(() => normalizePayablesSnapshot({ ...snapshot, asOfDate: '02.11.2026' })).toThrow()
    expect(() => normalizePayablesSnapshot({ ...snapshot, readAtUtc: '2026-11-02T10:00:00' })).toThrow()
  })

  it('requires an exact echoed category and rejects a mixed snapshot or drilldown', () => {
    const selected = { ...request, partyKind: 2 as const }
    expect(normalizePayablesSnapshot(scopedPayablesSnapshot(2), 2).partyKind).toBe(2)
    expect(normalizePayablesRows(scopedPayablesRows(2), selected).partyKind).toBe(2)
    expect(() => normalizePayablesSnapshot(payablesSnapshot(), 2)).toThrow()
    expect(() => normalizePayablesSnapshot(scopedPayablesSnapshot(3), 2)).toThrow()
    expect(() => normalizePayablesSnapshot({ ...payablesSnapshot(), partyKind: 2 }, 2)).toThrow()
    expect(() => normalizePayablesRows(payablesRows(), selected)).toThrow()
    expect(() => normalizePayablesRows({ ...payablesRows(), partyKind: 2 }, selected)).toThrow()
    expect(() => normalizePayablesRows(scopedPayablesRows(3), selected)).toThrow()
    expect(() => normalizePayablesSnapshot({ ...scopedPayablesSnapshot(2), partyKind: 7 }, 2)).toThrow()
  })

  it('sends the same explicit category for snapshot and drilldown', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(scopedPayablesSnapshot(3)).mockResolvedValueOnce(scopedPayablesRows(3))
    await getPayablesSnapshot('finance', undefined, 3)
    await getPayablesRows({ ...request, partyKind: 3 })
    expect(apiRequest).toHaveBeenCalledWith('/dashboards/payables', { query: { workspace: 'finance', partyKind: 3 }, signal: undefined })
    expect(apiRequest).toHaveBeenCalledWith('/dashboards/payables/rows', { query: { ...request, partyKind: 3 }, signal: undefined })
  })

  it('sends the day and currency and no sales-period parameters', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(payablesSnapshot()).mockResolvedValueOnce(payablesRows())
    await getPayablesSnapshot('finance')
    await getPayablesRows(request)
    expect(apiRequest).toHaveBeenCalledWith('/dashboards/payables', { query: { workspace: 'finance' }, signal: undefined })
    expect(apiRequest).toHaveBeenCalledWith('/dashboards/payables/rows', { query: request, signal: undefined })
  })
})
