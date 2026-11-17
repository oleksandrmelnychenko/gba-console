import { describe, expect, it } from 'vitest'
import { isImpossibleTypedDate, toDateString } from './dateHelpers'

describe('toDateString', () => {
  it('serializes date filters in an API-safe local format', () => {
    expect(toDateString('2026-06-17')).toBe('2026-06-17')
  })

  it('keeps local date-time filters parseable by ASP.NET', () => {
    expect(toDateString('2026-06-17T14:25')).toBe('2026-06-17T14:25:00')
  })

  it('passes invalid values through for server-side validation', () => {
    expect(toDateString('not-a-date')).toBe('not-a-date')
  })
})

describe('isImpossibleTypedDate', () => {
  it('flags dates that can never exist', () => {
    for (const text of ['31.02.2026', '99.99.9999', 'abc', '01.01.1800', '1.2.3.4']) {
      expect(isImpossibleTypedDate(text)).toBe(true)
    }
  })

  it('leaves valid and still-being-typed values alone', () => {
    for (const text of ['', '17.11.2026', '1.2.2026', '17.1', '17.11.20']) {
      expect(isImpossibleTypedDate(text)).toBe(false)
    }
  })
})
