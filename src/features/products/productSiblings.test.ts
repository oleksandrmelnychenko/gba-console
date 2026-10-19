import { describe, expect, it } from 'vitest'
import {
  findCurrentProductSiblingCard,
  formatProductCardsCount,
  formatProductSiblingCountHint,
  formatProductSiblingNotice,
  getProductSiblingCardLabel,
  getProductSiblingCardsTotals,
  getProductSiblingRowKey,
  getProductSiblingSourceLabel,
  hasProductSiblingCards,
  pluralizeUk,
} from './productSiblings'
import type { ProductSiblingCard } from './types'

const fenixCard: ProductSiblingCard = {
  Availabilities: [{ Amount: 6, OrganizationName: 'ТОВ «АМГ «КОНКОРД»', StorageId: 2968, StorageName: 'СКЛАД -3' }],
  IsCurrent: true,
  Name: 'Ступица колеса',
  ProductId: 38060322,
  ProductNetId: '37d7acb3-ad54-4d86-8f94-d5c2aff6ad6a',
  SoldQty: 0,
  SourceAmgCode: 382707,
  SourceFenixCode: 382707,
  StockQty: 6,
  VendorCode: '0701000260-MG',
}

const amgCard: ProductSiblingCard = {
  Availabilities: [],
  IsCurrent: false,
  Name: 'Ступица колеса',
  ProductId: 38286393,
  ProductNetId: 'f43233de-1889-4a52-923e-fca071adcfa3',
  SalesCount: 3,
  SoldQty: 4,
  SourceAmgCode: 464929,
  SourceFenixCode: null,
  StockQty: 0,
  VendorCode: '0701000260-MG',
}

describe('Ukrainian card plurals', () => {
  it('chooses the singular, few and many forms', () => {
    expect([1, 2, 3, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map((count) => pluralizeUk(count, ['картка', 'картки', 'карток'])))
      .toEqual(['картка', 'картки', 'картки', 'картки', 'карток', 'карток', 'карток', 'карток', 'картка', 'картки', 'карток', 'картка', 'карток'])
  })

  it('words the card notice in the accusative case', () => {
    expect(formatProductSiblingNotice(1)).toBe('Цей артикул має ще 1 картку')
    expect(formatProductSiblingNotice(2)).toBe('Цей артикул має ще 2 картки')
    expect(formatProductSiblingNotice(4)).toBe('Цей артикул має ще 4 картки')
    expect(formatProductSiblingNotice(5)).toBe('Цей артикул має ще 5 карток')
    expect(formatProductSiblingNotice(11)).toBe('Цей артикул має ще 11 карток')
    expect(formatProductSiblingNotice(21)).toBe('Цей артикул має ще 21 картку')
  })

  it('words the search marker and its hint in the nominative case', () => {
    expect(formatProductCardsCount(2)).toBe('2 картки')
    expect(formatProductCardsCount(5)).toBe('5 карток')
    expect(formatProductSiblingCountHint(1)).toBe('Є ще 1 картка')
    expect(formatProductSiblingCountHint(3)).toBe('Є ще 3 картки')
    expect(formatProductSiblingCountHint(7)).toBe('Є ще 7 карток')
  })
})

describe('product sibling card facts', () => {
  it('sums stock and sold quantity of the acceptance article', () => {
    expect(hasProductSiblingCards([fenixCard, amgCard])).toBe(true)
    expect(hasProductSiblingCards([fenixCard])).toBe(false)
    expect(hasProductSiblingCards([])).toBe(false)
    expect(getProductSiblingCardsTotals([fenixCard, amgCard])).toEqual({ soldQty: 4, stockQty: 6 })
  })

  it('falls back to storage rows when a card has no stock total', () => {
    expect(getProductSiblingCardsTotals([{ ...fenixCard, StockQty: undefined }, amgCard])).toEqual({ soldQty: 4, stockQty: 6 })
  })

  it('names a card by vendor code and 1C source codes', () => {
    expect(getProductSiblingSourceLabel(fenixCard)).toBe('AMG 382707 · Fenix 382707')
    expect(getProductSiblingSourceLabel(amgCard)).toBe('AMG 464929')
    expect(getProductSiblingSourceLabel({ ProductId: 7, SourceAmgCode: null, SourceFenixCode: null })).toBe('ID 7')
    expect(getProductSiblingCardLabel(amgCard)).toBe('0701000260-MG · AMG 464929')
    expect(getProductSiblingCardLabel({ SourceFenixCode: 12 })).toBe('Fenix 12')
  })

  it('finds the current card by its flag or by the product identifier', () => {
    expect(findCurrentProductSiblingCard([fenixCard, amgCard], amgCard.ProductNetId)).toBe(fenixCard)
    expect(findCurrentProductSiblingCard(
      [{ ...fenixCard, IsCurrent: false }, amgCard],
      amgCard.ProductNetId?.toUpperCase(),
    )).toBe(amgCard)
    expect(findCurrentProductSiblingCard([{ ...fenixCard, IsCurrent: false }], 'unknown')).toBeNull()
  })

  it('keeps row identifiers unchanged without a card and separates merged rows by card', () => {
    expect(getProductSiblingRowKey(null, 'row-1')).toBe('row-1')
    expect(getProductSiblingRowKey(undefined, 'row-1')).toBe('row-1')
    expect(getProductSiblingRowKey(amgCard, 'row-1')).toBe('38286393:row-1')
  })
})
