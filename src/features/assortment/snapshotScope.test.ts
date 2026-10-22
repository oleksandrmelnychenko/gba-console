import { describe, expect, it } from 'vitest'
import { requireMatchingAssortmentScopes } from './snapshotScope'
import type { ProductHistoryContract } from './types'
const base = { as_of: '2026-10-22', source_history_start: '2025-01-01', history_fingerprint: 'source-v1' } as ProductHistoryContract
describe('assortment snapshot scope', () => {
  it('accepts partial success with different calculation windows', () => {
    expect(() => requireMatchingAssortmentScopes([base, { ...base, effective_start: '2026-01-01' }])).not.toThrow()
  })
  it.each([{ as_of: '2026-10-21' }, { source_history_start: '2000-01-01' }, { history_fingerprint: 'source-v2' }])('rejects mixed source/date %j', (difference) => {
    expect(() => requireMatchingAssortmentScopes([base, { ...base, ...difference }])).toThrow('різні дати або джерела')
  })
})
