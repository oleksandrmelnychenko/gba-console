import { describe, expect, it } from 'vitest'
import { normalizeDashboardQueue } from './dashboardQueuesApi'
import type { WorkspaceQueueRequest } from '../queueTypes'

const request: WorkspaceQueueRequest = { workspace: 'driver', key: 'pending', from: '2026-10-01', to: '2026-11-01', asOf: '2026-10-22T12:00:00Z', offset: 0, limit: 50 }
const payload = () => ({ Workspace: 'driver', Key: 'pending', From: request.from, To: request.to, AsOfUtc: request.asOf, ReadAtUtc: request.asOf,
  Offset: 0, Limit: 50, Total: 1, AggregateValue: 1, Label: 'Очікують відправлення', Unit: 'count', TimeBasis: 'period',
  Formula: 'Листи без відправлення', Source: 'ShipmentList', Grain: 'Лист', Scope: 'Лише поточний водій',
  Rows: [{ Id: 17, NetUid: null, DocumentDate: null, Number: '17', Description: 'Очікує', Quantity: null, Route: null }] })

describe('exact dashboard queue response', () => {
  it('preserves unknown values and PascalCase metadata instead of inventing zero', () => {
    const data = normalizeDashboardQueue({ ...payload(), AggregateValue: null }, request)
    expect(data.aggregateValue).toBeNull()
    expect(data.rows[0].quantity).toBeNull()
    expect(data.scope).toBe('Лише поточний водій')
  })
  it('accepts lowerCamel nullable data', () => {
    const source = payload()
    const lower: Record<string, unknown> = Object.fromEntries(Object.entries(source).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value]))
    lower.rows = source.Rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value])))
    expect(normalizeDashboardQueue(lower, request).rows[0].netUid).toBeNull()
  })
  it.each([{ Workspace: 'client' }, { Key: 'assigned' }, { Offset: 50 }, { AsOfUtc: '2026-10-21T12:00:00Z' }, { From: '2026-09-01' }, { Total: 2 }, { AggregateValue: '1' }])('rejects wrong identity, pagination or malformed numbers: %o', change => {
    expect(() => normalizeDashboardQueue({ ...payload(), ...change }, request)).toThrow()
  })
  it('rejects duplicate row identities and external navigation', () => {
    const data = payload()
    expect(() => normalizeDashboardQueue({ ...data, Total: 2, Rows: [...data.Rows, ...data.Rows] }, request)).toThrow()
    expect(() => normalizeDashboardQueue({ ...data, Rows: [{ ...data.Rows[0], Route: '//outside.example' }] }, request)).toThrow()
  })
  it('accepts an exhausted page only with exact zero page rows and retained total', () => {
    expect(normalizeDashboardQueue({ ...payload(), Offset: 50, Rows: [] }, { ...request, offset: 50 }).total).toBe(1)
  })
})
