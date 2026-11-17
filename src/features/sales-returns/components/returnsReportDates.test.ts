import { describe, expect, it } from 'vitest'
import { isReportDateRangeReversed } from './returnsReportDates'

describe('returns report date range', () => {
  it('blocks a range whose start is after its end before any request', () => {
    expect(isReportDateRangeReversed('2026-12-31', '2020-01-01')).toBe(true)
    expect(isReportDateRangeReversed('2026-01-01', '2026-01-01')).toBe(false)
    expect(isReportDateRangeReversed('2026-01-01', '')).toBe(false)
  })
})
