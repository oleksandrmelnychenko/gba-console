import { expect, it } from 'vitest'
import { importedPaymentsRows } from './data/importedPayments.test-fixtures'
import { IMPORTED_PAYMENTS_CAPTIONS } from './data/importedPayments'
import { IMPORTED_PAYMENTS_EMPTY_STATE, IMPORTED_PAYMENTS_NOTE_PREFIXES } from './data/importedPaymentsSpreadsheet'
import { buildSpreadsheetSheet, buildSheetExportRows, getSpreadsheetNumberFormatter, getAdditiveColumns, calculateTotals, filterSheetRows, parseDelimitedText, detectDelimiter } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { getReportHeaderPresentation } from './pages/reportHeaderPresentation'
const parseCsv = (csv: string) => buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
const canonical = (rows: ReturnType<typeof buildSpreadsheetSheet>['rows']) => rows.map(row => ({ ...row, cells: row.cells.map(cell => cell ?? '') }))
it.each(['known', 'mixed', 'unknown'] as const)('preserves source14 %s values, 4dp and blank currency proof without local money totals', kind => {
  const sheet = buildSpreadsheetSheet('Report', importedPaymentsRows(kind))
  expect(getAdditiveColumns(sheet)).toEqual([false, false, false, false]); expect(calculateTotals(sheet.rows, getAdditiveColumns(sheet))).toEqual([null, null, null, null])
  expect(getSpreadsheetNumberFormatter(sheet, 3)?.format(-2.3401)).toBe('-2,3401')
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows)), again = parseCsv(csv)
  expect(again.header).toEqual(sheet.header); expect(canonical(again.rows)).toEqual(canonical(sheet.rows))
  if (kind !== 'unknown') expect(csv).toContain('12.3401')
  const filtered = filterSheetRows(sheet, kind === 'unknown' ? 'Непідтверджена' : 'надходження', '', '')
  expect(filtered.every(row => row.kind === 'data')).toBe(true)
  expect(canonical(parseCsv(buildSpreadsheetCsv(buildSheetExportRows(sheet, filtered))).rows)).toEqual(canonical(filtered))
  expect(buildSpreadsheetChartData(sheet, sheet.rows, 3).points.map(point => point.value)).toEqual(kind === 'unknown' ? [null] : kind === 'known' ? [12.3401, -2.3401] : [12.3401, -2.3401, 0])
})
it.each(Array.from({ length: 7 }, (_, index) => index + 1))('preserves complete-empty state for selected mask %i without inventing a money grand', mask => {
  const selected = [0, 1, 2].filter(index => mask & (1 << index)), sheet = buildSpreadsheetSheet('Report', importedPaymentsRows('empty', selected))
  expect(sheet.rows).toEqual([]); expect(sheet.header?.lines).toContain(IMPORTED_PAYMENTS_EMPTY_STATE)
  expect(sheet.columns.slice(1).map(column => column.split(' · ').at(-1))).toEqual(selected.map(index => IMPORTED_PAYMENTS_CAPTIONS[index]))
  expect(filterSheetRows(sheet, 'absent', '2026-08-01', '2026-08-02')).toBe(sheet.rows)
  const again = parseCsv(buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows)))
  expect(again.rows).toEqual([]); expect(again.header).toEqual(sheet.header)
})
it.each(['date', 'read-time', 'note', 'precision', 'caption', 'empty-grand'])('rejects malformed source14 %s', key => {
  const rows = importedPaymentsRows(key === 'empty-grand' ? 'empty' : 'known')
  if (key === 'date') rows[1] = ['Період: 31.02.2026 – 31.07.2026']
  if (key === 'read-time') rows[2] = ['Час читання (UTC): відсутній']
  if (key === 'note') rows.splice(6, 1)
  if (key === 'precision') rows[rows.length - 4][1] = 12.34011
  if (key === 'caption') rows[rows.length - 5][1] = 'Продажі без ПДВ'
  if (key === 'empty-grand') rows.push(['Загальний підсумок', 0, 0, 0])
  expect(() => buildSpreadsheetSheet('Report', rows)).toThrow('Некоректний файл записаних')
})
it('joins only source14 six logical notes while CSV retains original metadata rows', () => {
  const rows = importedPaymentsRows(), note = rows.findIndex(row => String(row[0]).startsWith('! Валюта записаних платежів:'))
  rows.splice(note + 1, 0, ['продовження пояснення валюти'])
  const sheet = buildSpreadsheetSheet('Report', rows), presentation = getReportHeaderPresentation(sheet.header!)
  expect(presentation.lines.some(line => line.includes('Валюта записаних платежів:') && line.endsWith('продовження пояснення валюти'))).toBe(true)
  expect(presentation.warnings.filter(line => IMPORTED_PAYMENTS_NOTE_PREFIXES.some(prefix => line.includes(prefix)))).toHaveLength(6)
  expect(sheet.header?.lines).toContain('продовження пояснення валюти')
})

it('retains both pivot column axes and selected money captions across CSV filtering', () => {
  const rows = importedPaymentsRows('known', [0, 2]), separator = rows.findIndex(row => !row.length)
  rows[3] = ['Рядки: Договір']; rows[4] = ['Колонки: Валюта рахунку, Напрям платежу']
  rows.splice(separator + 1, rows.length, ['', 'EUR [2]', 'EUR [2]', 'EUR [2]', 'EUR [2]'],
    ['', 'Надходження [1]', 'Надходження [1]', 'Виплата [2]', 'Виплата [2]'],
    ['', 'Записані платежі', 'Записані платежі', 'Записані платежі', 'Записані платежі'],
    ['Договір', IMPORTED_PAYMENTS_CAPTIONS[0], IMPORTED_PAYMENTS_CAPTIONS[2], IMPORTED_PAYMENTS_CAPTIONS[0], IMPORTED_PAYMENTS_CAPTIONS[2]],
    ['Договір [201]', 12.3401, 12.3401, 0, -2.3401], ['Загальний підсумок', 12.3401, 12.3401, 0, -2.3401])
  const sheet = buildSpreadsheetSheet('Report', rows)
  expect(sheet.header?.columnGroupings).toEqual(['Валюта рахунку', 'Напрям платежу'])
  expect(sheet.columns[4]).toBe('EUR [2] · Виплата [2] · Записані платежі · Різниця записаних платежів')
  const filtered = filterSheetRows(sheet, '[201]', '', ''), csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, filtered)), again = parseCsv(csv)
  expect(again.columns).toEqual(sheet.columns); expect(again.rows).toEqual(filtered)
  expect(buildSpreadsheetChartData(again, again.rows, 4).points.map(point => point.value)).toEqual([-2.3401])
  expect(getAdditiveColumns(again).every(value => !value)).toBe(true)
})
