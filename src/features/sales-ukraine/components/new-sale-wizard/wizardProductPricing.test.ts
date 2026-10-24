import { describe, expect, it } from 'vitest'
import { buildWizardProductPriceMatrix, buildWizardProductPriceRows } from './wizardProductPricing'
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


describe('product summary price matrix', () => {
  it('keeps explicit zero prices and agreement-price precedence', () => {
    expect(buildWizardProductPriceMatrix({
      currentPriceEur: 0, localCurrency: 'UAH',
      product: { CurrentPrice: 20, CurrentPriceEurToUah: 0, CurrentLocalPrice: 900 },
      pricing: { PriceEUR: 30, DiscountPriceEUR: 0, RetailPriceEUR: 0, RetailPriceLocal: 0, Pricing: { Name: 'Custom' } },
    })).toEqual([
      { key: 'current', label: 'Ціна', eur: 0, local: 0 },
      { key: 'base-eur', label: 'Custom', eur: 30, local: null },
      { key: 'discount-eur', label: 'Зі знижкою', eur: 0, local: null },
      { key: 'retail', label: 'Роздріб', eur: 0, local: 0 },
    ])
  })
})
