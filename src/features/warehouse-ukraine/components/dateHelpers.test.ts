import { describe, expect, it } from 'vitest'
import { toDateString } from './dateHelpers'

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
