import { describe, expect, it } from 'vitest'
import { DELETED_PRODUCT_LABEL, isDeletedProductAvailability } from './deletedProduct'

describe('isDeletedProductAvailability', () => {
  it('marks a deleted product that still has stock', () => {
    expect(isDeletedProductAvailability({ Amount: 2, Product: { VendorCode: 'F3-PRD-002', Deleted: true } })).toBe(true)
    expect(DELETED_PRODUCT_LABEL).toBe('видалений')
  })

  it('does not mark live products or rows without a product', () => {
    expect(isDeletedProductAvailability({ Amount: 5, Product: { VendorCode: 'F3-PRD-001', Deleted: false } })).toBe(false)
    expect(isDeletedProductAvailability({ Amount: 5, Product: { VendorCode: 'F3-PRD-001' } })).toBe(false)
    expect(isDeletedProductAvailability({ Amount: 5 })).toBe(false)
    expect(isDeletedProductAvailability(null)).toBe(false)
  })
})
