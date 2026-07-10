import { describe, expect, it } from 'vitest'
import {
  getProductGroupNames,
  getProductMainImage,
  getProductMainOriginalNumber,
  getProductOriginalNumbers,
  getProductWriteOffRuleLocaleLabel,
  isCriticalProductTop,
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

  it('recognises Latin and Cyrillic X9 product ranks as critical', () => {
    expect(isCriticalProductTop('x9')).toBe(true)
    expect(isCriticalProductTop(' X9 ')).toBe(true)
    expect(isCriticalProductTop('Х9')).toBe(true)
    expect(isCriticalProductTop('A9')).toBe(false)
    expect(isCriticalProductTop(undefined)).toBe(false)
  })

  it('splits searched products around the assortment drum search slot', () => {
    const products = [
      { VendorCode: 'A' },
      { VendorCode: 'B' },
      { VendorCode: 'C' },
      { VendorCode: 'D' },
    ] as Product[]

    expect(splitProductSearchResults(products)).toEqual({
      topProducts: [
        { VendorCode: 'A' },
        { VendorCode: 'B' },
      ],
      bottomProducts: [
        { VendorCode: 'C' },
        { VendorCode: 'D' },
      ],
    })
  })

  it('keeps the first down-arrow product at the start of the lower rail for odd result counts', () => {
    const products = [
      { VendorCode: 'A' },
      { VendorCode: 'B' },
      { VendorCode: 'C' },
      { VendorCode: 'D' },
      { VendorCode: 'E' },
    ] as Product[]

    expect(splitProductSearchResults(products)).toEqual({
      topProducts: [
        { VendorCode: 'A' },
        { VendorCode: 'B' },
      ],
      bottomProducts: [
        { VendorCode: 'C' },
        { VendorCode: 'D' },
        { VendorCode: 'E' },
      ],
    })
  })
})
