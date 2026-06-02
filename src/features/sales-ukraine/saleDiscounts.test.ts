import { describe, expect, it } from 'vitest'
import { getVisibleOrderItemBaseDiscount, isOrderItemBaseDiscountSuppressed } from './saleDiscounts'
import type { SalesUkraineOrderItem } from './types'

describe('sale discount helpers', () => {
  it('keeps base discount when product has no legacy suppression flags', () => {
    expect(getVisibleOrderItemBaseDiscount({ Discount: 12.5, Product: { Top: 'A' } } as SalesUkraineOrderItem)).toBe(12.5)
  })

  it('suppresses base discount for X9 top products', () => {
    const item = { Discount: 15, Product: { Top: 'Х9' } } as SalesUkraineOrderItem

    expect(isOrderItemBaseDiscountSuppressed(item)).toBe(true)
    expect(getVisibleOrderItemBaseDiscount(item)).toBe(0)
  })

  it('suppresses base discount for zero-sale and sale products', () => {
    expect(getVisibleOrderItemBaseDiscount({ Discount: 15, Product: { IsForZeroSale: true } } as SalesUkraineOrderItem)).toBe(0)
    expect(getVisibleOrderItemBaseDiscount({ Discount: 15, Product: { IsForSale: true } } as SalesUkraineOrderItem)).toBe(0)
  })

  it('does not invent base discount when backend did not send it', () => {
    expect(getVisibleOrderItemBaseDiscount({ Product: { Top: 'A' } } as SalesUkraineOrderItem)).toBeNull()
  })
})
