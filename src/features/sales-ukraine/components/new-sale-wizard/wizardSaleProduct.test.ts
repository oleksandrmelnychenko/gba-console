import { describe, expect, it } from 'vitest'
import { getWizardDisplayQty, getWizardSellableQty, type WizardSaleProduct } from './wizardSaleProduct'

describe('wizard sale product availability', () => {
  it('uses VAT availability for VAT sales', () => {
    const product = { AvailableQtyUk: 3, AvailableQtyUkReSale: 2, AvailableQtyUkVAT: 7 } as WizardSaleProduct

    expect(getWizardSellableQty(product, true)).toBe(7)
    expect(getWizardDisplayQty(product, true)).toBe(7)
  })

  it('uses Ukraine plus resale availability for non-VAT sales', () => {
    const product = { AvailableQtyUk: 3, AvailableQtyUkReSale: 2, AvailableQtyUkVAT: 7 } as WizardSaleProduct

    expect(getWizardSellableQty(product, false)).toBe(5)
    expect(getWizardDisplayQty(product, false)).toBe(5)
  })
})
