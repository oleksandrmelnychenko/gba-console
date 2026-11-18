import { describe, expect, it } from 'vitest'
import {
  getIncomeQuantityLimit,
  getIncomeReceivableQty,
  getIncomeRefusal,
  INCOME_NOT_RECEIVABLE_MESSAGE,
} from './actReconciliationIncomeAvailability'

describe('act reconciliation income availability (chaos2-orders F10 / w1-16)', () => {
  it('refuses income only when every chosen row has nothing left on the packing lists', () => {
    expect(getIncomeRefusal([{ IncomeReceivableQty: 0, NegativeDifference: true, QtyDifference: 6 }])).toBe(INCOME_NOT_RECEIVABLE_MESSAGE)
    expect(getIncomeRefusal([{ IncomeReceivableQty: 0 }, { IncomeReceivableQty: 2 }])).toBeNull()
    expect(getIncomeRefusal([])).toBeNull()
  })

  it('does not limit rows the server does not limit (supply-order acts, older API)', () => {
    expect(getIncomeRefusal([{ NegativeDifference: true, QtyDifference: 6 }])).toBeNull()
    expect(getIncomeRefusal([{ IncomeReceivableQty: null, QtyDifference: 6 }])).toBeNull()
    expect(getIncomeReceivableQty({ IncomeReceivableQty: -1 })).toBe(0)
  })

  it('caps the income quantity by what the packing lists still hold', () => {
    expect(getIncomeQuantityLimit({ IncomeReceivableQty: 2, QtyDifference: 6 })).toBe(2)
    expect(getIncomeQuantityLimit({ IncomeReceivableQty: 10, QtyDifference: 6 })).toBe(6)
    expect(getIncomeQuantityLimit({ QtyDifference: 6 })).toBe(6)
    expect(getIncomeQuantityLimit(null)).toBeUndefined()
  })
})
