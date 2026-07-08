import { describe, expect, it } from 'vitest'
import {
  canOpenDirectProductIncomeFromOrder,
  canOpenDirectProductIncomeFromRow,
} from './directOrderActions'

describe('direct order actions', () => {
  it('keeps product income available for direct orders even when invoice arrays are absent from list payloads', () => {
    expect(canOpenDirectProductIncomeFromRow({ kind: 'direct', netUid: 'order-1' }, true)).toBe(true)
    expect(canOpenDirectProductIncomeFromOrder({ NetUid: 'order-1' }, true)).toBe(true)
  })

  it('still respects permission, route identity and order kind', () => {
    expect(canOpenDirectProductIncomeFromRow({ kind: 'direct', netUid: 'order-1' }, false)).toBe(false)
    expect(canOpenDirectProductIncomeFromRow({ kind: 'direct', netUid: '' }, true)).toBe(false)
    expect(canOpenDirectProductIncomeFromRow({ kind: 'toUkraine', netUid: 'order-1' }, true)).toBe(false)
    expect(canOpenDirectProductIncomeFromOrder({ NetUid: 'order-1' }, false)).toBe(false)
    expect(canOpenDirectProductIncomeFromOrder({ NetUid: '' }, true)).toBe(false)
  })
})
