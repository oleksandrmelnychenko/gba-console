import { describe, expect, it } from 'vitest'
import { toMergedServiceDateTimeInput } from './mergedServiceDateInput'

describe('merged service date input', () => {
  it('preserves hour and minute for datetime-local fields', () => {
    expect(toMergedServiceDateTimeInput('2025-03-04T15:45:30')).toBe('2025-03-04T15:45')
  })

  it('accepts Date values', () => {
    expect(toMergedServiceDateTimeInput(new Date(2025, 2, 4, 9, 7, 30))).toBe('2025-03-04T09:07')
  })
})
