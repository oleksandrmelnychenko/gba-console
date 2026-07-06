import { describe, expect, it } from 'vitest'
import { buildWizardProductPriceRows } from './wizardProductPricing'
import type { WizardSaleProduct } from './wizardSaleProduct'

describe('buildWizardProductPriceRows', () => {
  it('maps legacy calculated pricing fields into the four displayed product prices', () => {
    const product = { CurrentPrice: 120 } satisfies WizardSaleProduct

    expect(
      buildWizardProductPriceRows({
        pricing: {
          DiscountPriceEUR: 108,
          DiscountRate: 10,
          PriceEUR: 120,
          Pricing: { Name: 'ЦО2' },
          RetailPriceEUR: 150,
          RetailPriceLocal: 6150,
        },
        product,
      }),
    ).toEqual([
      { currency: 'EUR', key: 'base-eur', label: 'ЦО2', value: 120 },
      { currency: 'EUR', key: 'discount-eur', label: 'Зі знижкою', tone: 'strong', value: 108 },
      { currency: 'EUR', key: 'retail-eur', label: 'Роздріб', value: 150 },
      { currency: 'UAH', key: 'retail-local', label: 'Роздріб', value: 6150 },
    ])
  })

  it('keeps the current product price visible while calculated pricing is loading', () => {
    const product = { CurrentPrice: 42.5 } satisfies WizardSaleProduct

    expect(buildWizardProductPriceRows({ pricing: null, product })).toEqual([
      { currency: 'EUR', key: 'base-eur', label: 'База', value: 42.5 },
      { currency: 'EUR', key: 'discount-eur', label: 'Зі знижкою', tone: 'strong', value: 42.5 },
    ])
  })
})
