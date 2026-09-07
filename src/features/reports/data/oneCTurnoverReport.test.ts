import { describe, expect, it } from 'vitest'
import type { OneCTurnoverScopeSummary } from '../types'
import { createOneCTurnoverReport, ONE_C_REPORT_LAYOUTS, oneCReportPeriodError } from './oneCTurnoverReport'

export const scopeFixture: OneCTurnoverScopeSummary = {
  Key: 'A'.repeat(64), Filters: { OrganizationIds: ['1'.repeat(32)], ProductKindId: '2'.repeat(32), ExcludeServices: true },
  OrganizationNames: ['Тестова організація 1С'], FirstDay: '2026-09-01', LastDay: '2026-09-03', LoadedDayCount: 2,
  OldestReadCompletedUtc: '2026-09-06T10:00:00Z', NewestReadCompletedUtc: '2026-09-06T10:00:01Z',
}

describe('consolidated 1C report payloads', () => {
  it.each(ONE_C_REPORT_LAYOUTS)('uses explicit cloned scope and supported fields for $id', layout => {
    const payload = createOneCTurnoverReport(scopeFixture, layout.id, '2026-09-01', '2026-09-03')
    expect(payload.dataSource).toBe(1)
    expect(payload.oneC).toEqual(scopeFixture.Filters)
    expect(payload.oneC).not.toBe(scopeFixture.Filters)
    expect(payload.selections).toEqual([])
    expect(payload.sorted.Row.map(row => row.key)).toEqual(layout.row)
    expect(payload.sorted.Col.map(col => col.key)).toEqual(layout.col)
    expect(payload.sorted.Measurements.map(measure => measure.Type)).toEqual(layout.measures)
  })

  it.each([
    ['', ''], ['2026-02-30', '2026-03-01'], ['2026-09-03', '2026-09-01'],
    ['2025-01-01', '2026-01-02'], ['2026-09-01T00:00:00Z', '2026-09-03'], ['1999-12-31', '2000-01-01'],
  ])('refuses invalid or unbounded dates %s to %s', (from, to) => {
    expect(oneCReportPeriodError(from, to)).not.toBeNull()
    expect(() => createOneCTurnoverReport(scopeFixture, 'daily', from, to)).toThrow()
  })

  it('accepts a leap day and a 366-day inclusive window', () => {
    expect(oneCReportPeriodError('2024-02-29', '2024-02-29')).toBeNull()
    expect(oneCReportPeriodError('2024-01-01', '2024-12-31')).toBeNull()
  })
})
