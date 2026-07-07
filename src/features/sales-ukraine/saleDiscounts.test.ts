import { describe, expect, it } from 'vitest'
import {
  getAverageBaseDiscount,
  getOrderItemBaseDiscountSuppressionReason,
  getPartialAverageBaseDiscount,
  getPartialUniformBaseDiscount,
  getUniformBaseDiscount,
  getVisibleOrderItemBaseDiscount,
} from './saleDiscounts'
import type { SalesUkraineOrderItem } from './types'

describe('sale discount helpers', () => {
  it('keeps base discount when product has no legacy suppression flags', () => {
    expect(getVisibleOrderItemBaseDiscount({ Discount: 12.5, Product: { Top: 'A' } } as SalesUkraineOrderItem)).toBe(12.5)
  })

  it('suppresses visible base discount for X9 and sale products when backend sends a contract discount', () => {
    expect(getVisibleOrderItemBaseDiscount({ Discount: 15, Product: { Top: 'Х9' } } as SalesUkraineOrderItem)).toBe(0)
    expect(getVisibleOrderItemBaseDiscount({ Discount: 15, Product: { IsForZeroSale: true } } as SalesUkraineOrderItem)).toBe(0)
    expect(getVisibleOrderItemBaseDiscount({ Discount: 15, Product: { IsForSale: true } } as SalesUkraineOrderItem)).toBe(0)
    expect(getOrderItemBaseDiscountSuppressionReason({ Discount: 15, Product: { Top: 'X9' } } as SalesUkraineOrderItem)).toBe('x9')
  })

  it('does not invent base discount when backend did not send it', () => {
    expect(getVisibleOrderItemBaseDiscount({ Product: { Top: 'A' } } as SalesUkraineOrderItem)).toBeNull()
  })

  it('returns uniform base discount for the main sales grid', () => {
    expect(getUniformBaseDiscount([{ Discount: 12 }, { Discount: 12 }] as SalesUkraineOrderItem[])).toBe(12)
  })

  it('returns average base discount only when all positions have a base discount', () => {
    expect(getAverageBaseDiscount([{ Discount: 10 }, { Discount: 20 }] as SalesUkraineOrderItem[])).toBe(15)
    expect(getAverageBaseDiscount([{ Discount: 10 }, { Discount: 0 }] as SalesUkraineOrderItem[])).toBeNull()
  })

  it('returns partial base discount when only some positions have a contract discount', () => {
    expect(getPartialUniformBaseDiscount([{ Discount: 20 }, { Discount: 0 }, { Discount: null }] as SalesUkraineOrderItem[])).toBe(20)
    expect(getPartialAverageBaseDiscount([{ Discount: 10 }, { Discount: 20 }, { Discount: 0 }] as SalesUkraineOrderItem[])).toBe(15)
  })
})
