import { describe, expect, it } from 'vitest'
import type { WizardSaleProduct } from './wizardSaleProduct'
import { findUniqueExactWizardProductSearchMatch } from './wizardProductSearchSelection'

describe('findUniqueExactWizardProductSearchMatch', () => {
  it('finds one exact vendor-code match regardless of case and outer whitespace', () => {
    const products = [
      product('other', 'CS1643M-SF'),
      product('exact', 'FSF1643-FL'),
    ]

    expect(findUniqueExactWizardProductSearchMatch('  fsf1643-fl  ', products)).toEqual({
      index: 1,
      product: products[1],
    })
  })

  it('accepts an exact article match when the vendor code differs', () => {
    const products = [{
      Articul: 'FSF1643-FL',
      NetUid: 'exact-article',
      VendorCode: 'INTERNAL-42',
    }] satisfies WizardSaleProduct[]

    expect(findUniqueExactWizardProductSearchMatch('FSF1643-FL', products)?.product.NetUid)
      .toBe('exact-article')
  })

  it('does not select a partial code match', () => {
    expect(findUniqueExactWizardProductSearchMatch('FSF1643', [product('partial', 'FSF1643-FL')]))
      .toBeNull()
  })

  it('does not select when the exact code belongs to more than one result', () => {
    const products = [product('first', 'FSF1643-FL'), product('second', 'FSF1643-FL')]

    expect(findUniqueExactWizardProductSearchMatch('FSF1643-FL', products)).toBeNull()
  })
})

function product(netUid: string, vendorCode: string): WizardSaleProduct {
  return { NetUid: netUid, VendorCode: vendorCode }
}
