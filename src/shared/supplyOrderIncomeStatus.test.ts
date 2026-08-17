import { describe, expect, it } from 'vitest'
import {
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
