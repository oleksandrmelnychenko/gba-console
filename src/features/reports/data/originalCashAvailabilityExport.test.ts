import { expect, it } from 'vitest'
import { availabilityRequest, availabilityFields } from './originalCashAvailability'
import { availabilityCapabilityFixture, availabilityResultFixture, availabilityPartialFixture, availabilityPoint } from './originalCashAvailability.fixtures'
import { availabilitySheet } from './originalCashAvailabilityExport'
import { defaultSheetCsv } from './originalDefaultReportExport'
it('exports the exact completed default table and point scope without adding totals or a calendar period', () => {
  const result = availabilityResultFixture(), sheet = availabilitySheet(result), csv = defaultSheetCsv(sheet)
  expect(sheet.lines.map(v => v.cells)).toEqual(result.Table.Rows); expect(sheet.total).toBeNull(); expect(sheet.labelColumns).toBe(0)
  expect(csv).toContain('Стан перед 2026-10-06 12:34:56'); expect(csv).not.toContain('включно'); expect(csv).not.toContain(result.ResultSha256!); expect(csv).not.toContain(result.DefinitionSha256)
})
it('optional management export retains actual currency caption filter and all ten native measures', () => {
  const filter = availabilityResultFixture().Choices[2].Value, request = availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, [filter], [availabilityFields[2]], true), result = availabilityResultFixture(request), sheet = availabilitySheet(result)
  expect(sheet.headers).toHaveLength(11); expect(sheet.lines[0].cells).toEqual(result.Table.Rows[0]); expect(sheet.note).toContain('Управлінська валюта: UAH'); expect(sheet.note).toContain('Наш рахунок'); expect(sheet.note).not.toContain(filter.Reference)
})
it('partial display preserves unknown money and missing captions explicitly rather than zero', () => {
  const result = availabilityPartialFixture(), sheet = availabilitySheet(result)
  expect(sheet.lines[0].cells).toEqual(['100.00', 'Недоступно', '5.00', '10.00', 'Недоступно'])
})
it('other default sheets retain their original inclusive period metadata', () => {
  const csv = defaultSheetCsv({ title: 'Інший звіт', from: '2026-10-01', through: '2026-10-06', headers: ['Сума'], labelColumns: 0, lines: [{ key: '1', cells: ['1.00'] }], total: null, note: '' })
  expect(csv).toContain('Період: 2026-10-01 – 2026-10-06, включно')
})
