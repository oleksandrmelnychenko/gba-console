import { revenueRows } from './revenueComparison.test-fixtures'
import { BUYER_SALES_SHARE_CAPTIONS } from './buyerSalesShare'
import { buyerShareOracleControls } from './buyerSalesShare.oracle-fixtures'
import { expect, it } from 'vitest'
import { buildSpreadsheetSheet, buildSheetExportRows, filterSheetRows, getAdditiveColumns, getSpreadsheetNumberFormatter, detectDelimiter, parseDelimitedText } from '../spreadsheet'
import { buildSpreadsheetCsv } from '../utils'
import { buyerShareRows } from './buyerSalesShare.test-fixtures'
import { BUYER_SALES_SHARE_EMPTY_STATE, BUYER_SALES_SHARE_NOTE_PREFIXES } from './buyerSalesShareSpreadsheet'
import { getReportHeaderPresentation } from '../pages/reportHeaderPresentation'
import { buildSpreadsheetChartData } from './spreadsheetChartData'
const parseSpreadsheetCsv = (csv: string) => parseDelimitedText(csv, detectDelimiter(csv))
const canonical = (rows: ReturnType<typeof buildSpreadsheetSheet>['rows']) => rows.map(row => ({ kind: row.kind, cells: row.cells.map(cell => cell ?? '') }))
it.each(Array.from({ length: 255 }, (_, i) => i + 1))('roundtrips selected mask%i caller order with all measures nonadditive and authoritative raw summary', mask => {
  const selected = [7, 6, 5, 4, 3, 2, 1, 0].filter(m => mask & (1 << m)), sheet = buildSpreadsheetSheet('BuyerShare', buyerShareRows('known', selected))
  const expected = selected.map(m => [20, 100, -80, -80, 80, 0, 80, 100][m])
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
  const sheet = buildSpreadsheetSheet(kind, buyerShareRows(kind)); const rows = sheet.rows.map(r => r.cells.slice(2))
  if (kind === 'raw-rounding') expect(rows.at(-1)).toEqual([0.33, 0.25, 0.08, 33.33, 99.67, 99.75, -0.08, -0.08])
  if (kind === 'current-unknown') expect(rows[0]).toEqual([null, 100, null, null, null, 0, null, null])
  if (kind === 'previous-unknown') expect(rows[0]).toEqual([100, null, null, null, 0, null, null, null])
  if (kind === 'both-unknown') expect(rows[0]).toEqual([null, null, null, null, null, null, null, null])
  expect(canonical(buildSpreadsheetSheet('csv', parseSpreadsheetCsv(buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))), 'flat').rows)).toEqual(canonical(sheet.rows))
})
it.each(Array.from({ length: 255 }, (_, i) => i + 1))('retains complete-empty selected grand and convention for mask%i through local filtering', mask => {
  const selected = [7, 6, 5, 4, 3, 2, 1, 0].filter(m => mask & (1 << m)), sheet = buildSpreadsheetSheet('empty', buyerShareRows('empty', selected))
  expect(sheet.header!.lines).toContain(BUYER_SALES_SHARE_EMPTY_STATE); expect(sheet.rows).toHaveLength(1); expect(sheet.rows[0].kind).toBe('total')
  expect(sheet.rows[0].cells.slice(2)).toEqual(selected.map(m => m === 3 || m === 7 ? 100 : 0)); expect(filterSheetRows(sheet, 'немає', '', '')).toEqual(sheet.rows)
  expect(buildSpreadsheetChartData(sheet, sheet.rows, 2).points).toEqual([])
})
it.each(BUYER_SALES_SHARE_NOTE_PREFIXES)('requires own metadata note %s', prefix => {
  const raw = buyerShareRows(); expect(() => buildSpreadsheetSheet('bad', raw.filter(r => !String(r[0]).trim().replace(/^! /, '').startsWith(prefix)))).toThrow(/часток продажів/)
})
it.each([1.001, Number.NaN, Number.POSITIVE_INFINITY, 10000000000000, '50%', 'не число'])('rejects invalid published numeric token %s', value => {
  const raw = buyerShareRows(); const leaf = raw.find(r => r[1] === 'Договір [201]')!; leaf[2] = value
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/часток продажів/)
})
it('does not allow a known derivative when a selected input is explicitly unknown', () => {
  const raw = buyerShareRows('current-unknown'); raw.find(r => r[1] === 'Договір [201]')![5] = 100
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/часток продажів/)
})
it('refuses forged empty zero percentage or invented leaf', () => {
  const raw = buyerShareRows('empty'); const grand = raw.find(r => r[0] === 'Загальний підсумок')!; grand[5] = 0
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/часток продажів/)
})

it('preserves negative and above-100 signed shares without clamping or adding them', () => {
  const sheet = buildSpreadsheetSheet('Signed', buyerShareRows('signed'))
  expect(sheet.rows.at(-1)!.cells.slice(2)).toEqual([-200, 50, -250, -500, 300, 50, 250, 500])
  expect(getAdditiveColumns(sheet).some(Boolean)).toBe(false)
})
it('requires both classes to share the selected period unknown status without erasing the other period', () => {
  const rows = buyerShareRows('current-unknown')
  rows.find(row => row[1] === 'Договір [201]')![6] = 0
  expect(() => buildSpreadsheetSheet('bad', rows)).toThrow(/часток продажів/)
})

it.each(['Звіт продажів', 'Довільна таблиця', ''])('rejects a relabelled share file before additive fallback: %s', title => {
  const rows = buyerShareRows(); rows[0] = [title]
  expect(() => buildSpreadsheetSheet('wrong', rows)).toThrow(/часток продажів/)
})
it('refuses duplicated metadata and a stale measure declaration', () => {
  const duplicate = buyerShareRows(); duplicate.splice(2, 0, duplicate[1])
  expect(() => buildSpreadsheetSheet('duplicate', duplicate)).toThrow(/часток продажів/)
  const wrong = buyerShareRows(); const measures = wrong.find(row => String(row[0]).startsWith('Показники:'))!
  measures[0] = 'Показники: ' + String(measures[0]).slice('Показники: '.length).split(', ').reverse().join(', ')
  expect(() => buildSpreadsheetSheet('wrong', wrong)).toThrow(/часток продажів/)
})

it.each(buyerShareOracleControls)('preserves independent Fraction oracle: $id, exact buyer/contract labels and authoritative totals', control => {
  const rows = buyerShareRows(control.rows.length === 1 ? 'empty' : 'known', control.fields.map(field => field - 39))
  const date = (value: string) => value.split('-').reverse().join('.')
  rows[1] = [`Поточний період: ${date(control.current.from)} – ${date(control.current.to)}`]
  rows[2] = [`Період порівняння: ${date(control.previous.from)} – ${date(control.previous.to)}`]
  const dataAt = rows.findIndex(row => row[0] === 'Клієнт' && row[1] === 'Договір') + 1
  rows.splice(dataAt, rows.length - dataAt, ...structuredClone(control.rows))
  const sheet = buildSpreadsheetSheet(control.id, rows)
  expect(sheet.rows.at(-1)!.cells.slice(2)).toEqual(control.grand)
  expect(canonical(sheet.rows).map(row => row.cells)).toEqual(control.rows.map(row => row.map(cell => cell ?? '')))
  const exported = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  const reloaded = buildSpreadsheetSheet('oracle.csv', parseSpreadsheetCsv(exported), 'flat')
  expect(canonical(reloaded.rows)).toEqual(canonical(sheet.rows))
  expect(getAdditiveColumns(reloaded).every(value => !value)).toBe(true)
})

it('does not interpret a legacy business label as source17 attribution', () => {
  const rows = revenueRows()
  rows.find(row => row[1] === 'Договір [201]')![1] = BUYER_SALES_SHARE_CAPTIONS[0]
  const sheet = buildSpreadsheetSheet('legacy', rows)
  expect(sheet.rows.some(row => row.cells[1] === BUYER_SALES_SHARE_CAPTIONS[0])).toBe(true)
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  expect(canonical(buildSpreadsheetSheet('legacy.csv', parseSpreadsheetCsv(csv), 'flat').rows)).toEqual(canonical(sheet.rows))
  expect(buildSpreadsheetSheet('ordinary', [['Назва', 'Сума'], [BUYER_SALES_SHARE_CAPTIONS[0], 10]], 'flat').rows[0].cells[0]).toBe(BUYER_SALES_SHARE_CAPTIONS[0])
})
