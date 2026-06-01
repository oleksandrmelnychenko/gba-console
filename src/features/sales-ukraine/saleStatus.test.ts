import { describe, expect, it } from 'vitest'
import { getStatusTypeKey, isStatusType } from './saleStatus'

describe('sale status helpers', () => {
  it('normalizes numeric and string enum values to the same key', () => {
    expect(getStatusTypeKey(0)).toBe('0')
    expect(getStatusTypeKey('0')).toBe('0')
    expect(getStatusTypeKey(null)).toBe('')
    expect(getStatusTypeKey(undefined)).toBe('')
  })

  it('matches numeric and string enum values against expected status', () => {
    expect(isStatusType(1, 1)).toBe(true)
    expect(isStatusType('1', 1)).toBe(true)
    expect(isStatusType('2', 1)).toBe(false)
    expect(isStatusType(undefined, 1)).toBe(false)
  })
})
