import { MARGIN_COMPARISON_CAPTIONS } from './marginComparison'
import { revenueRows } from './revenueComparison.test-fixtures'
import { expect, it } from 'vitest'
import { buildSpreadsheetSheet, buildSheetExportRows, filterSheetRows, getAdditiveColumns, getSpreadsheetNumberFormatter, detectDelimiter, parseDelimitedText } from '../spreadsheet'
import { buildSpreadsheetCsv } from '../utils'
import { marginRows } from './marginComparison.test-fixtures'
import { MARGIN_COMPARISON_EMPTY_STATE, MARGIN_COMPARISON_NOTE_PREFIXES } from './marginComparisonSpreadsheet'
import { getReportHeaderPresentation } from '../pages/reportHeaderPresentation'
import { buildSpreadsheetChartData } from './spreadsheetChartData'
const parseSpreadsheetCsv = (csv: string) => parseDelimitedText(csv, detectDelimiter(csv))
const canonical = (rows: ReturnType<typeof buildSpreadsheetSheet>['rows']) => rows.map(row => ({ kind: row.kind, cells: row.cells.map(cell => cell ?? '') }))
it.each(Array.from({ length: 15 }, (_, i) => i + 1))('roundtrips selected mask%i caller order with all measures nonadditive and authoritative raw summary', mask => {
  const selected = [3, 2, 1, 0].filter(m => mask & (1 << m)), sheet = buildSpreadsheetSheet('Revenue', marginRows('known', selected))
  const expected = selected.map(m => [15, 10, 5, 50][m])
  expect(sheet.rows.at(-1)!.cells.slice(2)).toEqual(expected); expect(getAdditiveColumns(sheet)).toEqual(sheet.columns.map(() => false))
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows)), reloaded = buildSpreadsheetSheet('CSV', parseSpreadsheetCsv(csv), 'flat')
  expect(canonical(reloaded.rows)).toEqual(canonical(sheet.rows)); expect(reloaded.header).toEqual(sheet.header)
  const filtered = filterSheetRows(sheet, 'Договір [201]', '', ''); expect(filtered).toHaveLength(1); expect(filtered[0].kind).toBe('data')
  const partial = buildSpreadsheetCsv(buildSheetExportRows(sheet, filtered)); expect(partial).not.toContain('Загальний підсумок'); expect(partial).not.toContain('Підсумок:')
  expect(canonical(buildSpreadsheetSheet('partial', parseSpreadsheetCsv(partial), 'flat').rows)).toEqual(canonical(filtered))
  for (let c = 2; c < sheet.columns.length; c += 1) {
    expect(getSpreadsheetNumberFormatter(sheet, c)!.format(50)).toBe('50,00')
    expect(buildSpreadsheetChartData(sheet, sheet.rows, c).points).toHaveLength(2)
  }
  expect(getReportHeaderPresentation(sheet.header!).warnings).toHaveLength(8)
})
it.each(['current-unknown', 'previous-unknown', 'both-unknown', 'raw-rounding'])('preserves %s without inferring from displayed operands', kind => {
  const sheet = buildSpreadsheetSheet(kind, marginRows(kind)); const rows = sheet.rows.map(r => r.cells.slice(2))
  if (kind === 'raw-rounding') expect(rows[0]).toEqual([0.01, 0, 0, 50])
  if (kind === 'current-unknown') expect(rows[0]).toEqual([null, 20, null, null])
  if (kind === 'previous-unknown') expect(rows[0]).toEqual([30, null, null, null])
  if (kind === 'both-unknown') expect(rows[0]).toEqual([null, null, null, null])
  expect(canonical(buildSpreadsheetSheet('csv', parseSpreadsheetCsv(buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))), 'flat').rows)).toEqual(canonical(sheet.rows))
})
it.each(Array.from({ length: 15 }, (_, i) => i + 1))('retains complete-empty selected grand and convention for mask%i through local filtering', mask => {
  const selected = [3, 2, 1, 0].filter(m => mask & (1 << m)), sheet = buildSpreadsheetSheet('empty', marginRows('empty', selected))
  expect(sheet.header!.lines).toContain(MARGIN_COMPARISON_EMPTY_STATE); expect(sheet.rows).toHaveLength(1); expect(sheet.rows[0].kind).toBe('total')
  expect(sheet.rows[0].cells.slice(2)).toEqual(selected.map(m => m === 3 ? 100 : 0)); expect(filterSheetRows(sheet, 'немає', '', '')).toEqual(sheet.rows)
  expect(buildSpreadsheetChartData(sheet, sheet.rows, 2).points).toEqual([])
})
it.each(MARGIN_COMPARISON_NOTE_PREFIXES)('requires own metadata note %s', prefix => {
  const raw = marginRows(); expect(() => buildSpreadsheetSheet('bad', raw.filter(r => !String(r[0]).trim().replace(/^! /, '').startsWith(prefix)))).toThrow(/маржі/)
})
it.each([1.001, Number.NaN, Number.POSITIVE_INFINITY, 10000000000000, '50%', 'не число'])('rejects invalid published numeric token %s', value => {
  const raw = marginRows(); const leaf = raw.find(r => r[1] === 'Договір [201]')!; leaf[2] = value
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/маржі/)
})
it('does not allow a known derivative when a selected input is explicitly unknown', () => {
  const raw = marginRows('current-unknown'); raw.find(r => r[1] === 'Договір [201]')![5] = 100
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/маржі/)
})
it('refuses forged empty zero percentage or invented leaf', () => {
  const raw = marginRows('empty'); const grand = raw.find(r => r[0] === 'Загальний підсумок')!; grand[5] = 0
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/маржі/)
})

it('preserves signed margin values and signed previous denominator without negating or clamping', () => {
  const sheet = buildSpreadsheetSheet('signed', marginRows('signed'))
  expect(sheet.rows[0].cells.slice(2)).toEqual([20, -10, 30, -300])
  expect(getAdditiveColumns(sheet).every(value => !value)).toBe(true)
})
it.each(['Звіт продажів', 'Довільна таблиця', ''])('rejects a relabelled margin file without additive fallback: %s', title => {
  const raw = marginRows(); raw[0][0] = title
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/маржі/)
})
it('keeps the shared change-rule note in ordinary revenue reports and ignores legacy body captions', () => {
  expect(() => buildSpreadsheetSheet('revenue', revenueRows())).not.toThrow()
  const legacy = revenueRows(); legacy.find(row => row[1] === 'Договір [201]')![0] = MARGIN_COMPARISON_CAPTIONS[0]
  expect(buildSpreadsheetSheet('legacy', legacy).rows.find(row => row.cells[1] === 'Договір [201]')!.cells[0]).toBe(MARGIN_COMPARISON_CAPTIONS[0])
})

it('requires consistent selected derivative unknown masks without recomputing rounded ratios', () => {
  for (const selected of [[0,1,2,3], [2,3]]) {
    const raw = marginRows('known', selected)
    const leaf = raw.find(row => row[1] === 'Договір [201]')!
    leaf[2 + selected.indexOf(2)] = null
    expect(() => buildSpreadsheetSheet('inconsistent', raw)).toThrow(/маржі/)
  }
})
it('ignores stale local date filters because contract rows have no event date', () => {
  const sheet = buildSpreadsheetSheet('margin', marginRows())
  expect(filterSheetRows(sheet, '', '1900-01-01', '1900-01-02')).toEqual(sheet.rows)
})
