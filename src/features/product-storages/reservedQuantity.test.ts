import { describe, expect, it } from 'vitest'
import { getReservedQuantity } from './reservedQuantity'

describe('getReservedQuantity', () => {
  it('is the lot stock minus the free amount', () => {
    expect(getReservedQuantity({ Amount: 7, LotQty: 10 })).toBe(3)
    expect(getReservedQuantity({ Amount: 0, LotQty: 6 })).toBe(6) // fully reserved, still listed
  })

  it('is zero when nothing is reserved or the server sent no lot quantity', () => {
    expect(getReservedQuantity({ Amount: 10, LotQty: 10 })).toBe(0)
    expect(getReservedQuantity({ Amount: 10 })).toBe(0)
    expect(getReservedQuantity({ Amount: 12, LotQty: 10 })).toBe(0)
  })
})
