import { describe, expect, it } from 'vitest'
import type { ProductCapitalizationSearchProduct } from './types'
import { resolveProductCapitalizationSelection } from './productCapitalizationSelection'

const products: ProductCapitalizationSearchProduct[] = [
  { Id: 1, NetUid: 'product-1', Name: 'Product 1', VendorCode: 'ABC-001' },
  { Id: 2, NetUid: 'product-2', Name: 'Product 2', VendorCode: 'ABC-002' },
]

describe('resolveProductCapitalizationSelection', () => {
  it('keeps an explicitly selected product', () => {
    expect(resolveProductCapitalizationSelection(products[1], products, 'ABC-001')).toBe(products[1])
  })

  it('matches a manually entered exact vendor code', () => {
    expect(resolveProductCapitalizationSelection(null, products, ' abc-001 ')).toBe(products[0])
  })

  it('uses the single search result when the user did not pick from the dropdown', () => {
    expect(resolveProductCapitalizationSelection(null, [products[0]], 'ABC')).toBe(products[0])
  })

  it('does not guess when multiple results remain ambiguous', () => {
    expect(resolveProductCapitalizationSelection(null, products, 'ABC')).toBeNull()
  })
})
