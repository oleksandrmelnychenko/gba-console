import { expect, it } from 'vitest'
import { createOriginalRevenueRequest, isOriginalRevenueCapabilities, isOriginalRevenueCatalogueEntry,
  normalizeOriginalRevenueReport, originalRevenueCellText, originalRevenueMonthError, originalRevenuePeriods } from './originalRevenue'
import { originalRevenueCapability, originalRevenueCatalogueEntry, originalRevenueCells, originalRevenueInput, originalRevenueReport } from './originalRevenue.test-fixtures'

const request = () => createOriginalRevenueRequest(originalRevenueCapability(), '2026-09')
it('accepts only the exact original capability and catalogue identity without a native32 alias or captured status gate', () => {
  expect(isOriginalRevenueCapabilities(originalRevenueCapability())).toBe(true)
  expect(isOriginalRevenueCatalogueEntry(originalRevenueCatalogueEntry())).toBe(true)
  expect(isOriginalRevenueCapabilities({ ...originalRevenueCapability(), SourceIdentity: { ...originalRevenueCapability().SourceIdentity, SourceId: 'native:32' } })).toBe(false)
  expect(isOriginalRevenueCapabilities({ ...originalRevenueCapability(), Filters: ['ClientId'] })).toBe(false)
  expect(isOriginalRevenueCatalogueEntry({ ...originalRevenueCatalogueEntry(), Id: 'native:32' })).toBe(false)
})
it('binds calendar month and previous month, with only the exact server representability bounds', () => {
  expect(originalRevenuePeriods('2026-01')).toEqual({ CurrentPeriod: { From: '2026-01-01', ThroughExclusive: '2026-02-01' },
    PreviousPeriod: { From: '2025-12-01', ThroughExclusive: '2026-01-01' } })
  for (const invalid of ['0001-01', '0001-02', '9999-12', '2026-13', '2026-9']) expect(originalRevenueMonthError(invalid)).not.toBeNull()
  expect(originalRevenueMonthError('0001-03')).toBeNull()
  expect(originalRevenueMonthError('2040-01')).toBeNull()
  expect(request()).toEqual({ Version: 1, SourceIdentity: originalRevenueCapability().SourceIdentity, Month: '2026-09' })
})
it('preserves wide native Client IDs and known unattributed EUR money in the server grand total', () => {
  const report = originalRevenueReport(), normalized = normalizeOriginalRevenueReport(report, request())
  expect(normalized).toBe(report)
  expect(normalized.Rows[0].ClientId).toBe('9007199254740993')
  expect(normalized.Rows[1].ClientId).toBeNull(); expect(normalized.Rows[1].Cells[0].Value).toBe('60')
  expect(normalized.Totals.Cells[0].Value).toBe('210'); expect(normalized.Totals.Cells[2].Value).toBe('68')
})
it('retains wide exact money strings and raw fractional percent, formatting two places only for display', () => {
  const report = originalRevenueReport(), row = report.Rows[0]
  const gross = '123456789012345678901234567890.1234567890123456789012'
  row.Current.GrossEur = gross; row.Cells[0].Value = gross
  row.Cells[2].Value = '21.2389380530973451327433628319'
  expect(normalizeOriginalRevenueReport(report, request()).Rows[0].Current.GrossEur).toBe(gross)
  expect(originalRevenueCellText(gross, null)).toBe(gross.replace('.', ','))
  expect(originalRevenueCellText(row.Cells[2].Value, 2)).toBe('21,24')
  expect(row.Cells[2].Value).toBe('21.2389380530973451327433628319')
})
it('keeps unknown money local and preserves known previous-zero percentage while current remains NULL', () => {
  const report = originalRevenueReport(), row = report.Rows[0]
  row.Current = originalRevenueInput(null); row.Previous = originalRevenueInput('0', 0)
  row.Cells = originalRevenueCells([null, '0', '100', null])
  report.Totals.Current = originalRevenueInput(null, 2); report.Totals.Previous = originalRevenueInput('50')
  report.Totals.Cells = originalRevenueCells([null, '50', null, null])
  expect(normalizeOriginalRevenueReport(report, request()).Rows[0].Cells[2].Value).toBe('100')
  expect(report.Rows[1].Cells[0].Value).toBe('60'); expect(report.Totals.Cells[0].Value).toBeNull()
  row.Current.GrossEur = '0'
  expect(() => normalizeOriginalRevenueReport(report, request())).toThrow('некоректний результат')
})
it('accepts genuinely empty population with observed-zero inputs and all four server cells', () => {
  const report = originalRevenueReport(); report.Rows = []
  report.Totals = { Current: originalRevenueInput('0', 0), Previous: originalRevenueInput('0', 0), Cells: originalRevenueCells(['0', '0', '100', '0']) }
  expect(normalizeOriginalRevenueReport(report, request()).Totals.Cells.map(cell => cell.Value)).toEqual(['0', '0', '100', '0'])
})
it('rejects conflicting row attribution, duplicate identities and invented zero for missing money', () => {
  const report = originalRevenueReport()
  report.Rows[1].Attributed = true
  expect(() => normalizeOriginalRevenueReport(report, request())).toThrow('некоректний результат')
  report.Rows[1].Attributed = false; report.Rows.push(structuredClone(report.Rows[1]))
  expect(() => normalizeOriginalRevenueReport(report, request())).toThrow('некоректний результат')
  report.Rows.pop(); report.Rows[0].Current.UnknownMoneyLines = 1
  expect(() => normalizeOriginalRevenueReport(report, request())).toThrow('некоректний результат')
})
it('rejects stale period, reordered columns, unbound native source or non-UTC observation before exposing files', () => {
  for (const change of [
    (report: ReturnType<typeof originalRevenueReport>) => { report.Month = '2026-08' },
    (report: ReturnType<typeof originalRevenueReport>) => { report.Columns.reverse() },
    (report: ReturnType<typeof originalRevenueReport>) => { report.ObservationStartedAtUtc = '2026-10-01T12:00:00' },
  ]) { const report = originalRevenueReport(); change(report); expect(() => normalizeOriginalRevenueReport(report, request())).toThrow('некоректний результат') }
  expect(() => createOriginalRevenueRequest({ ...originalRevenueCapability(), Executable: false }, '2026-09')).toThrow('Сервер не підтвердив')
})
