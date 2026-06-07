import { describe, expect, it } from 'vitest'
import {
  getProductGroupNames,
  getProductMainImage,
  getProductMainOriginalNumber,
  getProductOriginalNumbers,
  getProductWriteOffRuleLocaleLabel,
  splitProductSearchResults,
} from './utils'
import type { Product } from './types'

describe('product utils', () => {
  it('ignores deleted product relations in display helpers', () => {
    const product: Product = {
      ProductImages: [
        { Deleted: true, ImageUrl: 'https://example.test/deleted-main.jpg', IsMainImage: true },
        { ImageUrl: 'https://example.test/active.jpg' },
      ],
      ProductOriginalNumbers: [
        { Deleted: true, IsMainOriginalNumber: true, OriginalNumber: { Number: 'DELETED' } },
        { IsMainOriginalNumber: true, OriginalNumber: { MainNumber: 'ACTIVE' } },
      ],
      ProductProductGroups: [
        { Deleted: true, ProductGroup: { Name: 'Deleted group' } },
        { ProductGroup: { Deleted: true, Name: 'Deleted nested group' } },
        { ProductGroup: { Name: 'Active group' } },
      ],
    }

    expect(getProductGroupNames(product)).toBe('Active group')
    expect(getProductMainImage(product)?.ImageUrl).toBe('https://example.test/active.jpg')
    expect(getProductMainOriginalNumber(product)).toBe('ACTIVE')
    expect(getProductOriginalNumbers(product)).toHaveLength(1)
  })

  it('keeps write-off rule locale labels aligned with stored locale codes', () => {
    expect(getProductWriteOffRuleLocaleLabel('uk')).toBe('Україна')
    expect(getProductWriteOffRuleLocaleLabel('pl')).toBe('Польща')
    expect(getProductWriteOffRuleLocaleLabel(undefined)).toBe('Невідомий регіон')
  })

  it('keeps searched products in next-selection order for the assortment drum', () => {
    const products = [
      { VendorCode: 'A' },
      { VendorCode: 'B' },
      { VendorCode: 'C' },
      { VendorCode: 'D' },
    ] as Product[]

    expect(splitProductSearchResults(products)).toEqual({
      topProducts: [],
      bottomProducts: products,
    })
  })
})
