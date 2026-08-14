import { describe, expect, it } from 'vitest'
import {
  formatExchangeRate,
  formatPrice,
  formatUnitPrice,
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
  it('keeps the synchronized accounting and management unit costs visibly distinct', () => {
    expect(formatUnitPrice(1.49699858182768)).toBe('1,4970')
    expect(formatUnitPrice(1.4976938980838341)).toBe('1,4977')
  })

  it('keeps monetary totals at cents while unit costs retain four decimal places', () => {
    expect(formatPrice(299.399716365536)).toBe('299,40')
    expect(formatUnitPrice(1.5)).toBe('1,5000')
    expect(formatUnitPrice(undefined)).toBe('-')
  })

  it('keeps four decimal places for imported document exchange rates', () => {
    expect(formatExchangeRate(51.083)).toBe('51,0830')
    expect(formatExchangeRate(51.06)).toBe('51,0600')
  })

  it('does not invent an exchange rate when the API value is missing or invalid', () => {
    expect(formatExchangeRate(undefined)).toBe('-')
    expect(formatExchangeRate(Number.NaN)).toBe('-')
  })

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
