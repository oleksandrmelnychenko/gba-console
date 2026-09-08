import { expect, it } from 'vitest'
import { buildSpreadsheetSheet, buildSheetExportRows, filterSheetRows, getAdditiveColumns, getSpreadsheetNumberFormatter, detectDelimiter, parseDelimitedText } from '../spreadsheet'
import { buildSpreadsheetCsv } from '../utils'
import { revenueRows } from './revenueComparison.test-fixtures'
import { REVENUE_COMPARISON_EMPTY_STATE, REVENUE_COMPARISON_NOTE_PREFIXES } from './revenueComparisonSpreadsheet'
import { getReportHeaderPresentation } from '../pages/reportHeaderPresentation'
import { buildSpreadsheetChartData } from './spreadsheetChartData'
const parseSpreadsheetCsv = (csv: string) => parseDelimitedText(csv, detectDelimiter(csv))
const canonical = (rows: ReturnType<typeof buildSpreadsheetSheet>['rows']) => rows.map(row => ({ kind: row.kind, cells: row.cells.map(cell => cell ?? '') }))
it.each(Array.from({ length: 15 }, (_, i) => i + 1))('roundtrips selected mask%i caller order with all measures nonadditive and authoritative raw summary', mask => {
  const selected = [3, 2, 1, 0].filter(m => mask & (1 << m)), sheet = buildSpreadsheetSheet('Revenue', revenueRows('known', selected))
  const expected = selected.map(m => [150.01, 100, 50.01, 50.01][m])
  expect(sheet.rows.at(-1)!.cells.slice(2)).toEqual(expected); expect(getAdditiveColumns(sheet)).toEqual(sheet.columns.map(() => false))
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows)), reloaded = buildSpreadsheetSheet('CSV', parseSpreadsheetCsv(csv), 'flat')
  expect(canonical(reloaded.rows)).toEqual(canonical(sheet.rows)); expect(reloaded.header).toEqual(sheet.header)
  const filtered = filterSheetRows(sheet, 'Договір [201]', '', ''); expect(filtered).toHaveLength(1); expect(filtered[0].kind).toBe('data')
  const partial = buildSpreadsheetCsv(buildSheetExportRows(sheet, filtered)); expect(partial).not.toContain('Загальний підсумок'); expect(partial).not.toContain('Підсумок:')
  expect(canonical(buildSpreadsheetSheet('partial', parseSpreadsheetCsv(partial), 'flat').rows)).toEqual(canonical(filtered))
  for (let c = 2; c < sheet.columns.length; c += 1) {
    expect(getSpreadsheetNumberFormatter(sheet, c)!.format(50)).toBe('50,00')
    expect(buildSpreadsheetChartData(sheet, sheet.rows, c).points).toHaveLength(3)
  }
  expect(getReportHeaderPresentation(sheet.header!).warnings).toHaveLength(8)
})
it.each(['current-unknown', 'previous-unknown', 'both-unknown', 'raw-rounding'])('preserves %s without inferring from displayed operands', kind => {
  const sheet = buildSpreadsheetSheet(kind, revenueRows(kind)); const rows = sheet.rows.map(r => r.cells.slice(2))
  if (kind === 'raw-rounding') expect(rows[0]).toEqual([0.01, 0, 0, 50])
  if (kind === 'current-unknown') expect(rows[0]).toEqual([null, 100, null, null])
  if (kind === 'previous-unknown') expect(rows[0]).toEqual([50, null, null, null])
  if (kind === 'both-unknown') expect(rows[0]).toEqual([null, null, null, null])
  expect(canonical(buildSpreadsheetSheet('csv', parseSpreadsheetCsv(buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))), 'flat').rows)).toEqual(canonical(sheet.rows))
})
it.each(Array.from({ length: 15 }, (_, i) => i + 1))('retains complete-empty selected grand and convention for mask%i through local filtering', mask => {
  const selected = [3, 2, 1, 0].filter(m => mask & (1 << m)), sheet = buildSpreadsheetSheet('empty', revenueRows('empty', selected))
  expect(sheet.header!.lines).toContain(REVENUE_COMPARISON_EMPTY_STATE); expect(sheet.rows).toHaveLength(1); expect(sheet.rows[0].kind).toBe('total')
  expect(sheet.rows[0].cells.slice(2)).toEqual(selected.map(m => m === 3 ? 100 : 0)); expect(filterSheetRows(sheet, 'немає', '', '')).toEqual(sheet.rows)
  expect(buildSpreadsheetChartData(sheet, sheet.rows, 2).points).toEqual([])
})
it.each(REVENUE_COMPARISON_NOTE_PREFIXES)('requires own metadata note %s', prefix => {
  const raw = revenueRows(); expect(() => buildSpreadsheetSheet('bad', raw.filter(r => !String(r[0]).trim().replace(/^! /, '').startsWith(prefix)))).toThrow(/виручки/)
})
it.each([1.001, Number.NaN, Number.POSITIVE_INFINITY, 10000000000000, '50%', 'не число'])('rejects invalid published numeric token %s', value => {
  const raw = revenueRows(); const leaf = raw.find(r => r[1] === 'Договір [201]')!; leaf[2] = value
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/виручки/)
})
it('does not allow a known derivative when a selected input is explicitly unknown', () => {
  const raw = revenueRows('current-unknown'); raw.find(r => r[1] === 'Договір [201]')![5] = 100
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/виручки/)
})
it('refuses forged empty zero percentage or invented leaf', () => {
  const raw = revenueRows('empty'); const grand = raw.find(r => r[0] === 'Загальний підсумок')!; grand[5] = 0
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/виручки/)
})
