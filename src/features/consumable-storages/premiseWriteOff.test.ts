import { describe, expect, it } from 'vitest'
import {
  formatPremiseMoney,
  getCurrencyLabel,
  getWriteOffAvailableQty,
  parseWriteOffQuantity,
  summarizeWriteOffItems,
} from './premiseWriteOff'
import type { ConsumableProduct, DeprecatedConsumableOrder, DeprecatedConsumableOrderItem } from './types'

const t = (text: string, values?: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_match, key: string) => String(values?.[key] ?? ''))

const paper: ConsumableProduct = { MeasureUnit: { Name: 'шт' }, Name: 'QA Папір А4', NetUid: 'paper', TotalQty: 7 }

function itemOf(qty: number, extra: Partial<DeprecatedConsumableOrderItem> = {}): DeprecatedConsumableOrderItem {
  return { ConsumablesOrderItem: { ConsumableProduct: paper, Qty: 10 }, Qty: qty, ...extra }
}

describe('premise write-off quantity', () => {
  it('reads a decimal comma as a decimal, never as 25', () => {
    expect(parseWriteOffQuantity('2,5', { unit: 'кг' }, t)).toEqual({ error: null, qty: 2.5 })
  })

  it('rejects negatives, text and exponent notation visibly', () => {
    expect(parseWriteOffQuantity('-3', {}, t).error).toBe('Кількість не може бути від’ємною')
    expect(parseWriteOffQuantity('abc', {}, t).error).toBe('Введіть число')
    expect(parseWriteOffQuantity('1e5', {}, t).error).toBe('Введіть число')
    expect(parseWriteOffQuantity('0', {}, t).error).toBe('Кількість має бути більшою за 0')
  })

  it('needs whole numbers for piece units and blocks more than available', () => {
    expect(parseWriteOffQuantity('2,5', { unit: 'шт' }, t).error).toBe('Для одиниці «шт» кількість має бути цілою')
    expect(parseWriteOffQuantity('999', { available: 8, unit: 'шт' }, t).error).toBe('Більше, ніж доступно (8)')
    expect(parseWriteOffQuantity('8', { available: 8, unit: 'шт' }, t).error).toBeNull()
  })
})

describe('premise write-off availability (WH-13)', () => {
  it('is the current stock for a new write-off', () => {
    expect(getWriteOffAvailableQty(itemOf(1), [paper], null)).toBe(7)
  })

  it('adds back only what this write-off already took', () => {
    const editedOrder: DeprecatedConsumableOrder = { DepreciatedConsumableOrderItems: [itemOf(1)], NetUid: 'wo-2' }

    expect(getWriteOffAvailableQty(itemOf(1), [paper], editedOrder)).toBe(8)
  })

  it('uses the written-off quantity when the product is no longer on stock', () => {
    const editedOrder: DeprecatedConsumableOrder = { DepreciatedConsumableOrderItems: [itemOf(3)], NetUid: 'wo-3' }

    expect(getWriteOffAvailableQty(itemOf(3), [], editedOrder)).toBe(3)
  })
})

describe('premise write-off totals and formatting (WH-10/12)', () => {
  it('sums the write-off rows per currency', () => {
    const uah = { Code: 'UAH', Name: 'Гривня' }

    expect(summarizeWriteOffItems([
      itemOf(2, { Currency: uah, TotalPrice: 300 }),
      itemOf(1, { Currency: uah, TotalPrice: 150 }),
    ])).toEqual([{ currency: 'UAH', qty: 3, total: 450 }])
  })

  it('formats money like the console and labels currencies by code', () => {
    expect(formatPremiseMoney(1200).replace(/\s/g, ' ')).toBe('1 200,00')
    expect(getCurrencyLabel({ Code: 'UAH', Name: 'Гривня' })).toBe('UAH')
    expect(getCurrencyLabel({ Name: 'Гривня' })).toBe('Гривня')
  })
})
