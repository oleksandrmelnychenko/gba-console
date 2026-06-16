import { describe, expect, it } from 'vitest'
import { formatDateInputForQuery, SYNC_DATA_RANGE_START, toDateTimeQuery, toQueryString } from './dateTime'

describe('SYNC_DATA_RANGE_START', () => {
  it('matches the current operational sync baseline', () => {
    expect(SYNC_DATA_RANGE_START).toBe('2025-01-01')
  })
})

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

describe('toDateTimeQuery', () => {
  it('expands date-only inputs to full-day DateTime boundaries', () => {
    expect(toDateTimeQuery('2026-06-01', 'start')).toContain('T')
    expect(toDateTimeQuery('2026-06-01', 'start')).toContain('00:00:00.000')
    expect(toDateTimeQuery('2026-06-01', 'end')).toContain('23:59:59.999')
  })

  it('passes invalid date-only inputs through for server-side validation', () => {
    expect(toDateTimeQuery('2026-02-31', 'end')).toBe('2026-02-31')
  })
})

describe('toQueryString', () => {
  it('serializes arrays as repeated query keys for ASP.NET query binding', () => {
    expect(toQueryString({ forAmg: true, types: ['0', '3', '4'] })).toBe('?forAmg=true&types=0&types=3&types=4')
  })
})
