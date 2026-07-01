import { describe, expect, it } from 'vitest'
import { getWizardDisplayQty, getWizardSellableQty, getWizardStorageQty, type WizardSaleProduct } from './wizardSaleProduct'

describe('wizard sale product availability', () => {
  it('uses VAT availability for VAT sales', () => {
    const product = { AvailableQtyUk: 3, AvailableQtyUkReSale: 2, AvailableQtyUkVAT: 7 } as WizardSaleProduct

    expect(getWizardSellableQty(product, true)).toBe(7)
    expect(getWizardDisplayQty(product, true)).toBe(7)
  })

  it('keeps display availability separate from resale for non-VAT sales', () => {
    const product = { AvailableQtyUk: 3, AvailableQtyUkReSale: 2, AvailableQtyUkVAT: 7 } as WizardSaleProduct

    expect(getWizardSellableQty(product, false)).toBe(5)
    expect(getWizardStorageQty(product, false)).toBe(3)
    expect(getWizardDisplayQty(product, false)).toBe(3)
  })

  it('uses warehouse rows before aggregate Ukraine availability for display', () => {
    const product = {
      AvailableQtyUk: 99,
      AvailableQtyUkReSale: 2,
      ProductAvailabilities: [{ Amount: 4 }, { Amount: 1 }],
    } as WizardSaleProduct

    expect(getWizardStorageQty(product, false)).toBe(5)
    expect(getWizardSellableQty(product, false)).toBe(7)
  })
})
