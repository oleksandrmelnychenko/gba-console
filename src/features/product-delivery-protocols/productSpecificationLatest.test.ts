import { describe, expect, it } from 'vitest'
import { getLatestProductSpecificationFromList } from './productSpecificationLatest'
import type { ProductSpecificationEntity } from './specificationTypes'

describe('product specification latest selector', () => {
  it('uses the newest Created value instead of array order', () => {
    const specifications: ProductSpecificationEntity[] = [
      { Id: 5, Created: '2025-01-10T10:00:00Z', SpecificationCode: 'older-tail' },
      { Id: 3, Created: '2025-02-10T10:00:00Z', SpecificationCode: 'newer-middle' },
      { Id: 7, Created: '2025-01-20T10:00:00Z', SpecificationCode: 'older-end' },
    ]

    expect(getLatestProductSpecificationFromList(specifications)?.SpecificationCode).toBe('newer-middle')
  })

  it('uses highest Id as a tie-breaker when Created is equal', () => {
    const specifications: ProductSpecificationEntity[] = [
      { Id: 8, Created: '2025-02-10T10:00:00Z', SpecificationCode: 'lower-id' },
      { Id: 11, Created: '2025-02-10T10:00:00Z', SpecificationCode: 'higher-id' },
    ]

    expect(getLatestProductSpecificationFromList(specifications)?.SpecificationCode).toBe('higher-id')
  })

  it('returns null for empty input', () => {
    expect(getLatestProductSpecificationFromList([])).toBeNull()
    expect(getLatestProductSpecificationFromList(null)).toBeNull()
  })
})
