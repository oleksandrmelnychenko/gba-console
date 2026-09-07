import { describe, expect, it } from 'vitest'
import { validateOneCTurnoverSync } from './oneCTurnoverSyncForm'
import type { OneCTurnoverSyncCatalog, OneCTurnoverSyncFilters } from './types'

const catalog: OneCTurnoverSyncCatalog = {
  Organizations: [{ Id: '11'.repeat(16), Name: 'Фенікс' }],
  ProductKinds: [{ Id: '22'.repeat(16), Name: 'Товар' }],
}
const filters: OneCTurnoverSyncFilters = {
  oneCOrganizationIds: [catalog.Organizations[0].Id], oneCProductKindId: catalog.ProductKinds[0].Id, oneCExcludeServices: false,
}
const range = { from: '2026-08-01', to: '2026-08-31' }
const validate = (next = filters, nextCatalog: OneCTurnoverSyncCatalog | null = catalog, dates = range, types = ['6']) =>
  validateOneCTurnoverSync(dates, types, next, nextCatalog, '2026-09-06')

describe('explicit turnover sync filters', () => {
  it('accepts an exact named source scope with 31 days and explicit include-services', () => {
    expect(validate()).toBeNull()
  })
  it('rejects 32 days, invalid dates and missing document types', () => {
    expect(validate(filters, catalog, { ...range, to: '2026-09-01' })).toContain('31')
    expect(validate(filters, catalog, { ...range, to: '2026-02-31' })).not.toBeNull()
    expect(validate(filters, catalog, range, [])).toContain('типи документів')
  })
  it('requires loaded catalog, an explicitly selected organization and a known source kind', () => {
    expect(validate(filters, null)).toContain('довідники')
    expect(validate({ ...filters, oneCOrganizationIds: [] })).toContain('організації')
    expect(validate({ ...filters, oneCOrganizationIds: ['LOCAL-1'] })).toContain('організації')
    expect(validate({ ...filters, oneCProductKindId: '' })).toContain('вид номенклатури')
  })
})
