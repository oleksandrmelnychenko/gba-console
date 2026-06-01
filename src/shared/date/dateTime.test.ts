import { describe, expect, it } from 'vitest'
import { formatDateInputForQuery } from './dateTime'

describe('formatDateInputForQuery', () => {
  it('keeps date-only input as a local date without UTC conversion', () => {
    expect(formatDateInputForQuery('2026-06-01')).toBe('2026-06-01')
  })

  it('formats date-time input without timezone shifting', () => {
    expect(formatDateInputForQuery('2026-06-01T09:30')).toBe('2026-06-01T09:30:00')
  })

  it('passes invalid non-empty values through for server-side validation', () => {
    expect(formatDateInputForQuery('not-a-date')).toBe('not-a-date')
    expect(formatDateInputForQuery('2026-02-31')).toBe('2026-02-31')
  })
})
