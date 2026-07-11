import { describe, expect, it } from 'vitest'
import { getWizardDisplayQty, getWizardSellableQty, getWizardStorageQty, type WizardSaleProduct } from './wizardSaleProduct'

describe('wizard sale product availability', () => {
  const product = {
    AvailableQtyUk: 3,
    AvailableQtyUkReSale: 2,
    AvailableQtyUkVAT: 7,
    ProductAvailabilities: [{ Amount: 11 }, { Amount: 13 }, { Amount: 17 }],
  } as WizardSaleProduct

  it('uses only VAT availability for VAT sales', () => {
    expect(getWizardStorageQty(product, true)).toBe(7)
    expect(getWizardSellableQty(product, true)).toBe(7)
    expect(getWizardDisplayQty(product, true)).toBe(7)
  })

  it('uses the agreement-scoped Ukraine bucket for non-VAT storage and display', () => {
    expect(getWizardStorageQty(product, false)).toBe(3)
    expect(getWizardDisplayQty(product, false)).toBe(3)
  })

  it('adds resale exactly once for non-VAT sellable availability', () => {
    expect(getWizardSellableQty(product, false)).toBe(5)
  })

  it.each([
    ['foreign organization', 11],
    ['VAT storage', 13],
    ['Poland storage', 17],
  ])('does not leak a %s row into agreement-scoped quantities', (_label, amount) => {
    const productWithUnrelatedRow = {
      ...product,
      ProductAvailabilities: [{ Amount: amount }],
    } as WizardSaleProduct

    expect(getWizardStorageQty(productWithUnrelatedRow, false)).toBe(3)
    expect(getWizardSellableQty(productWithUnrelatedRow, false)).toBe(5)
    expect(getWizardStorageQty(productWithUnrelatedRow, true)).toBe(7)
    expect(getWizardSellableQty(productWithUnrelatedRow, true)).toBe(7)
  })

  it('does not use warehouse rows when the agreement-scoped bucket is absent', () => {
    const productWithoutAgreementQty = {
      AvailableQtyUkReSale: 2,
      ProductAvailabilities: [{ Amount: 41 }],
    } as WizardSaleProduct

    expect(getWizardStorageQty(productWithoutAgreementQty, false)).toBeUndefined()
    expect(getWizardDisplayQty(productWithoutAgreementQty, false)).toBe(0)
    expect(getWizardSellableQty(productWithoutAgreementQty, false)).toBe(2)
    expect(getWizardSellableQty(productWithoutAgreementQty, true)).toBeUndefined()
  })
})
