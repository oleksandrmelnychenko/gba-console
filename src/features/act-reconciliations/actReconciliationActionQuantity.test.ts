import { describe, expect, it } from 'vitest'
import {
  getDefaultActionQuantity,
  resolveActionToOperationQty,
  validateActionQuantity,
} from './actReconciliationActionQuantity'
import type { ActReconciliationItem } from './types'

describe('act reconciliation action quantity', () => {
  it('defaults preview quantity to the full difference', () => {
    expect(getDefaultActionQuantity(item({ QtyDifference: 7 }))).toBe(7)
  })

  it('keeps the legacy changed quantity fallback when resolving submit quantity', () => {
    expect(resolveActionToOperationQty(item({ QtyDifference: 7 }), 3)).toBe(3)
    expect(resolveActionToOperationQty(item({ QtyDifference: 7 }), 0)).toBe(7)
    expect(resolveActionToOperationQty(item({ QtyDifference: 7 }), '')).toBe(7)
  })

  it('rejects missing, zero, negative, and over-difference quantities', () => {
    expect(validateActionQuantity('', 7)).toMatchObject({ isValid: false, reason: 'required' })
    expect(validateActionQuantity(0, 7)).toMatchObject({ isValid: false, reason: 'positive' })
    expect(validateActionQuantity(-1, 7)).toMatchObject({ isValid: false, reason: 'positive' })
    expect(validateActionQuantity(8, 7)).toMatchObject({ isValid: false, reason: 'overLimit' })
  })

  it('rejects rows that do not have a positive difference limit', () => {
    expect(validateActionQuantity(1, 0)).toMatchObject({ isValid: false, reason: 'invalidLimit' })
    expect(validateActionQuantity(1, -2)).toMatchObject({ isValid: false, reason: 'invalidLimit' })
    expect(validateActionQuantity(1, undefined)).toMatchObject({ isValid: false, reason: 'invalidLimit' })
  })
})

function item(overrides: ActReconciliationItem): ActReconciliationItem {
  return overrides
}
