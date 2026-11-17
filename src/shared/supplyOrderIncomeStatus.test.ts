import { describe, expect, it } from 'vitest'
import {
  getSupplyOrderIncomePillClass,
  getSupplyOrderIncomeStatusLabel,
  SUPPLY_ORDER_INCOME_STATUS_LABEL,
} from './supplyOrderIncomeStatus'

describe('supply order income status labels', () => {
  it('maps the legacy IsPlaced completion flag to product income wording', () => {
    const label = getSupplyOrderIncomeStatusLabel(true)

    expect(label).toBe('Оприходувано')
    expect(label).not.toBe('Розміщено')
    expect(SUPPLY_ORDER_INCOME_STATUS_LABEL).toBe(label)
  })

  it.each([false, null, undefined])('does not claim product income for %s', (isPlaced) => {
    expect(getSupplyOrderIncomeStatusLabel(isPlaced)).toBe('Не оприходувано')
  })
})

describe('partly received supply order', () => {
  it('reads «Частково оприходувано» while only some columns are received', () => {
    expect(getSupplyOrderIncomeStatusLabel(false, true)).toBe('Частково оприходувано')
    expect(getSupplyOrderIncomePillClass(false, true)).toBe('is-yellow')
  })

  it('a fully received order stays «Оприходувано» even if the partial flag is still set', () => {
    expect(getSupplyOrderIncomeStatusLabel(true, true)).toBe('Оприходувано')
    expect(getSupplyOrderIncomePillClass(true, true)).toBe('is-green')
    expect(getSupplyOrderIncomePillClass(false, false)).toBe('is-gray')
  })
})
