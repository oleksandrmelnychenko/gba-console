import { describe, expect, it } from 'vitest'
import {
  buildProductUploadPriceConfigurations,
  getDuplicateProductUploadPricingIds,
  getProductPriceBreakdown,
  hasDuplicateProductUploadPricings,
  isDuplicateProductUploadPricingId,
} from './productPricing'

describe('product pricing helpers', () => {
  it('keeps retail, base and discount price fields separate', () => {
    const breakdown = getProductPriceBreakdown({
      DiscountPriceEUR: 15.25,
      DiscountRate: 12,
      PriceEUR: 17.5,
      Pricing: { Name: ' Bulk 2 ' },
      RetailPriceEUR: 20,
      RetailPriceLocal: 820,
    })

    expect(breakdown).toEqual({
      basePriceEUR: 17.5,
      discountPriceEUR: 15.25,
      discountRate: 12,
      hasBasePrice: true,
      hasDiscount: true,
      pricingName: 'Bulk 2',
      retailPriceEUR: 20,
      retailPriceLocal: 820,
    })
  })

  it('ignores non-finite price values', () => {
    const breakdown = getProductPriceBreakdown({
      DiscountPriceEUR: Number.NaN,
      PriceEUR: Number.POSITIVE_INFINITY,
      RetailPriceEUR: 0,
    })

    expect(breakdown.hasBasePrice).toBe(false)
    expect(breakdown.hasDiscount).toBe(false)
    expect(breakdown.retailPriceEUR).toBe(0)
  })

  it('detects duplicate upload pricing ids and ignores empty rows', () => {
    const rows = [
      { pricingId: '' },
      { pricingId: '12' },
      { pricingId: ' 12 ' },
      { pricingId: '15' },
      { pricingId: null },
    ]

    expect(getDuplicateProductUploadPricingIds(rows)).toEqual(['12'])
    expect(hasDuplicateProductUploadPricings(rows)).toBe(true)
    expect(isDuplicateProductUploadPricingId(rows, '12')).toBe(true)
    expect(isDuplicateProductUploadPricingId(rows, '15')).toBe(false)
  })

  it('serializes only valid upload pricing rows', () => {
    expect(
      buildProductUploadPriceConfigurations([
        { columnNumber: 4, pricingId: '12' },
        { columnNumber: 0, pricingId: '13' },
        { columnNumber: 5, pricingId: '' },
        { columnNumber: 6, pricingId: 'abc' },
      ]),
    ).toEqual([{ ColumnNumber: 4, PricingId: 12 }])
  })
})
