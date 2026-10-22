import wire from '../payables-wire.testData.json'
import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { payablesRows, payablesSnapshot, payablesWorld } from '../payablesTestData'
import type { PayablesRowsRequest } from '../payablesTypes'
import { getPayablesRows, getPayablesSnapshot, normalizePayablesRows, normalizePayablesSnapshot } from './dashboardPayablesApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const request: PayablesRowsRequest = { workspace: 'finance', world: 'fenix', publicationId: payablesWorld().publicationId!, currencyCode: 'USD', offset: 0, limit: 50 }

describe('payables immutable source contract', () => {
  it('accepts the real .NET serializer casing, exact source currency830 and exclusive midnight cutoff', () => {
    const snapshot = normalizePayablesSnapshot(wire.snapshot)
    const world = snapshot.worlds[0]
    expect(world.excludedKeys).toBe(2)
    expect(world.sourceCutoffUtc).toBe('2026-10-22T21:00:00Z')
    expect(world.buckets[0]).toMatchObject({ currencyCode: '830', currencyLabel: null, payable: 1527, advance: 0 })
    const rows = normalizePayablesRows(wire.rows, { ...request, publicationId: world.publicationId!, currencyCode: '830' })
    expect(rows.aggregate).toEqual({ signedBalance: -1527, payable: 1527, advance: 0 })
    expect(rows.rows[0].partyKind).toBe(2)
  })

  it('preserves independent worlds, currencies, gross liability and advances, including unavailable source', () => {
    const data = normalizePayablesSnapshot(payablesSnapshot())
    expect(data.worlds[0].buckets[0]).toMatchObject({ payable: 100, advance: 20, signedBalance: -80 })
    expect(data.worlds[1]).toMatchObject({ status: 'unavailable', buckets: [], reason: 'Валюту боргу не підтверджено' })
  })

  it.each(['world', 'publicationId', 'currencyCode', 'offset', 'limit'] as const)('rejects a rows response for different %s', key => {
    expect(() => normalizePayablesRows({ ...payablesRows(), [key]: key === 'offset' || key === 'limit' ? 99 : 'different' }, request)).toThrow()
  })

  it('rejects dropped rows, duplicate row identities and reversed debt sign', () => {
    const data = payablesRows()
    expect(() => normalizePayablesRows({ ...data, rows: data.rows.slice(0, 1) }, request)).toThrow()
    expect(() => normalizePayablesRows({ ...data, rows: [data.rows[0], data.rows[0]] }, request)).toThrow()
    expect(() => normalizePayablesRows({ ...data, rows: [{ ...data.rows[0], payable: 0, advance: 100 }, data.rows[1]] }, request)).toThrow()
  })

  it('keeps confirmed zero rows and rejects incomplete confirmed scope', () => {
    const zero = { ...payablesRows(), total: 1, aggregate: { signedBalance: 0, payable: 0, advance: 0 }, rows: [{ ...payablesRows().rows[0], signedBalance: 0, payable: 0, advance: 0 }] }
    expect(normalizePayablesRows(zero, request).rows).toHaveLength(1)
    const snapshot = payablesSnapshot(); snapshot.worlds[0].scopeComplete = false
    expect(() => normalizePayablesSnapshot(snapshot)).toThrow()
  })

  it('rejects duplicated worlds/currencies, missing currency and offset-free source time', () => {
    const snapshot = payablesSnapshot()
    expect(() => normalizePayablesSnapshot({ ...snapshot, worlds: [snapshot.worlds[0], snapshot.worlds[0]] })).toThrow()
    for (const bad of [
      { ...payablesWorld(), excludedKeys: -1 },
      { ...payablesWorld(), requestedKeys: 3 },
      { ...payablesWorld(), requestedKeys: 1, returnedKeys: 2 },
      { ...payablesWorld(), sourceCutoffUtc: '2026-10-23T00:00:00' },
      { ...payablesWorld(), buckets: [...payablesWorld().buckets, ...payablesWorld().buckets] },
      { ...payablesWorld(), buckets: [{ ...payablesWorld().buckets[0], currencyCode: '' }] },
    ]) expect(() => normalizePayablesSnapshot({ ...snapshot, worlds: [bad, snapshot.worlds[1]] })).toThrow()
  })

  it('sends publication/world/currency scope and no sales-period parameters', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(payablesSnapshot()).mockResolvedValueOnce(payablesRows())
    await getPayablesSnapshot('finance')
    await getPayablesRows(request)
    expect(apiRequest).toHaveBeenCalledWith('/dashboards/payables', { query: { workspace: 'finance' }, signal: undefined })
    expect(apiRequest).toHaveBeenCalledWith('/dashboards/payables/rows', { query: request, signal: undefined })
  })
})
