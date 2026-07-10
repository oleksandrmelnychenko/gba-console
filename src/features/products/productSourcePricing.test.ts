import { describe, expect, it } from 'vitest'
import { buildProductSourceComparisonRows, isPolishPricingName } from './productSourcePricing'

describe('product source pricing comparison', () => {
  it('merges source rows by pricing name and calculates Fenix minus AMG', () => {
    const rows = buildProductSourceComparisonRows(
      {
        Prices: [
          { PriceEur: 1.7514, PricingName: 'ЦО1' },
          { PriceEur: 1.4, PricingName: 'ЦО2' },
        ],
      },
      {
        Prices: [
          { PriceEur: 2.002, PricingName: 'ЦО1' },
          { PriceEur: 1.54, PricingName: 'ЦО2' },
        ],
      },
    )

    expect(rows).toEqual([
      expect.objectContaining({ differenceEur: 0.2506, pricingName: 'ЦО1' }),
      expect.objectContaining({ differenceEur: 0.14, pricingName: 'ЦО2' }),
    ])
  })

  it('keeps source-only price types and leaves the difference empty', () => {
    const rows = buildProductSourceComparisonRows(
      { Prices: [{ PriceEur: 1.4, PricingName: 'ЦО2' }] },
      { Prices: [{ PriceEur: 3.2, PricingName: 'ЦЗ' }] },
    )

    expect(rows).toEqual([
      expect.objectContaining({ differenceEur: undefined, pricingName: 'ЦЗ' }),
      expect.objectContaining({ differenceEur: undefined, pricingName: 'ЦО2' }),
    ])
  })

  it('hides Polish price types in both Latin and mixed-script spellings', () => {
    const rows = buildProductSourceComparisonRows(
      {
        Prices: [
          { PriceEur: 3.2, PricingName: 'PL rozn' },
          { PriceEur: 3.4, PricingName: 'РL dill' },
          { PriceEur: 1.4, PricingName: 'ЦО2' },
        ],
      },
      null,
    )

    expect(rows.map((row) => row.pricingName)).toEqual(['ЦО2'])
    expect(isPolishPricingName('PL1')).toBe(true)
  })
})
