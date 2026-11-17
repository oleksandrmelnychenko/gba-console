import { describe, expect, it } from 'vitest'
import { getSupplierDisplayName } from './supplyReturnSupplier'

describe('getSupplierDisplayName', () => {
  it('uses the full name in both the list and the details', () => {
    expect(getSupplierDisplayName({ FullName: 'F1 Постачальник GmbH', SupplierName: 'F1 Постачальник' })).toBe('F1 Постачальник GmbH')
    expect(getSupplierDisplayName({ SupplierName: 'F1 Постачальник' })).toBe('F1 Постачальник')
    expect(getSupplierDisplayName(null)).toBeUndefined()
  })
})
