import { describe, expect, it } from 'vitest'
import { clientActivityHeaderLines, clientActivityWorkbookRows } from './data/clientActivity.test-fixtures'
import { CLIENT_ACTIVITY_COUNT_CAPTION, CLIENT_ACTIVITY_EMPTY_STATE, CLIENT_ACTIVITY_NOTE_PREFIXES } from './data/clientActivityReport'
import { buildSpreadsheetChartData, getChartMeasureOptions } from './data/spreadsheetChartData'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, filterSheetRows, getAdditiveColumns, getSpreadsheetNumberFormatter, isCurrentReportSheet, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'

const roundtrip = (kind: 'known' | 'disjoint' | 'unknown' | 'empty') => {
  const sheet = buildSpreadsheetSheet('Report', clientActivityWorkbookRows(kind))
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  return { sheet, csv, imported: buildSpreadsheetSheet('report.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat') }
}
describe('distinct client count workbook presentation', () => {
  it.each(['known', 'disjoint'] as const)('preserves source union grand and never infers additivity, including accidental equal sum: %s', kind => {
    const { sheet, csv, imported } = roundtrip(kind)
    expect(sheet.header?.lines).toEqual(clientActivityHeaderLines)
    expect(sheet.rows.filter(row => row.kind === 'data').map(row => row.cells[1])).toEqual([2, 2])
    expect(sheet.rows.find(row => row.kind === 'total')?.cells[1]).toBe(kind === 'known' ? 3 : 4)
    expect(imported.rows).toEqual(sheet.rows); expect(imported.header).toEqual(sheet.header)
    expect(getAdditiveColumns(sheet)).toEqual([false, false])
    expect(calculateTotals(sheet.rows, getAdditiveColumns(sheet))).toEqual([null, null])
    expect(csv).not.toContain('2.00'); expect(getSpreadsheetNumberFormatter(sheet, 1)?.format(1000)).toBe('1 000')
    expect(getSpreadsheetNumberFormatter(sheet, 0)).toBeUndefined()
    expect(isCurrentReportSheet(sheet)).toBe(false)
    expect(getChartMeasureOptions(sheet)).toEqual([{ label: `Активність клієнтів · ${CLIENT_ACTIVITY_COUNT_CAPTION}`, value: '1' }])
    expect(buildSpreadsheetChartData(sheet, sheet.rows, 1).points.map(point => point.value)).toEqual([2, 2])
  })
  it('keeps filtered data and metadata without calculating a new union, including after CSV import', () => {
    const { sheet } = roundtrip('disjoint'), filtered = filterSheetRows(sheet, '2026-06', '', '')
    expect(filtered).toEqual([{ kind: 'data', cells: ['2026-06', 2] }])
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, filtered))
    const imported = buildSpreadsheetSheet('filtered.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(imported.rows).toEqual(filtered); expect(imported.header).toEqual(sheet.header)
    expect(getAdditiveColumns(imported)).toEqual([false, false])
    expect(calculateTotals(imported.rows, getAdditiveColumns(imported))).toEqual([null, null])
    expect(csv).not.toContain('Загальний підсумок')
  })
  it('preserves unknown attribution as blank in leaf, subtotal and grand; charts retain a gap', () => {
    const { sheet, imported } = roundtrip('unknown')
    expect(sheet.rows.map(row => row.cells[1])).toEqual([2, 2, null, null, null])
    expect(imported.rows.map(row => row.cells[1])).toEqual([2, 2, '', '', ''])
    expect(buildSpreadsheetChartData(imported, imported.rows, 1).points.map(point => point.value)).toEqual([2, null])
    expect(imported.header?.warnings).toEqual(expect.arrayContaining([expect.stringContaining('один рядок без підтвердженої')]))
  })
  it('renders complete-empty as zero grand and no client rows, preserved through CSV and charts', () => {
    const { sheet, imported } = roundtrip('empty')
    expect(sheet.rows).toEqual([{ kind: 'total', cells: ['Загальний підсумок', 0] }])
    expect(sheet.header?.lines).toContain(CLIENT_ACTIVITY_EMPTY_STATE)
    expect(imported.rows).toEqual(sheet.rows)
    expect(buildSpreadsheetChartData(sheet, sheet.rows, 1).points).toEqual([])
    expect(getAdditiveColumns(sheet)).toEqual([false, false])
    const filtered = filterSheetRows(sheet, 'відсутній клієнт', '2026-07-01', '2026-07-15')
    expect(filtered).toBe(sheet.rows)
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, filtered))
    expect(buildSpreadsheetSheet('empty.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat').rows).toEqual(sheet.rows)
  })
  it.each(CLIENT_ACTIVITY_NOTE_PREFIXES)('refuses source12 with missing required note %s without treating it as plain CSV', prefix => {
    const rows = clientActivityWorkbookRows().filter(row => !String(row[0]).includes(prefix))
    expect(() => buildSpreadsheetSheet('bad.xlsx', rows)).toThrow('Некоректний файл активності клієнтів')
  })
  it.each(['period', 'readtime', 'separator', 'measure', 'duplicate-note', 'blank-duplicate-note', 'duplicate-rows', 'duplicate-columns', 'snapshot', 'empty-state-with-data', 'empty-no-state', 'empty-unknown-grand', 'empty-positive-grand'])(
    'refuses malformed or contradictory attribution: %s', kind => {
      let rows = clientActivityWorkbookRows(kind.startsWith('empty-') && kind !== 'empty-state-with-data' ? 'empty' : 'known')
      if (kind === 'period') rows = rows.filter(row => !String(row[0]).startsWith('Період:'))
      if (kind === 'readtime') rows = rows.filter(row => !String(row[0]).startsWith('Час читання'))
      if (kind === 'separator') rows = rows.filter(row => row.length > 0)
      if (kind === 'measure') rows[5] = ['Показники: Кількість продажів', 'Показники: Кількість продажів']
      if (kind === 'duplicate-note') rows.splice(8, 0, [...rows[7]])
      if (kind === 'blank-duplicate-note') rows.splice(8, 0, ['! Джерело активності клієнтів:'])
      if (kind === 'duplicate-rows') rows.splice(4, 0, ['Рядки: Інший клієнт'])
      if (kind === 'duplicate-columns') rows.splice(5, 0, ['Колонки: По місяцях'])
      if (kind === 'snapshot') rows.splice(1, 0, ['Поточний стан: знімок операційних записів GBA'])
      if (kind === 'empty-state-with-data') rows.splice(12, 0, [CLIENT_ACTIVITY_EMPTY_STATE, CLIENT_ACTIVITY_EMPTY_STATE])
      if (kind === 'empty-no-state') rows = rows.filter(row => row[0] !== CLIENT_ACTIVITY_EMPTY_STATE)
      if (kind === 'empty-unknown-grand') rows.at(-1)![1] = null
      if (kind === 'empty-positive-grand') rows.at(-1)![1] = 1
      expect(() => buildSpreadsheetSheet('bad.xlsx', rows)).toThrow('Некоректний файл активності клієнтів')
    })
  it.each([1.5, -1, 200001, Number.NaN, Infinity, 'невизначено', true])('rejects invalid count %s instead of rounding or inventing a value', value => {
    const rows = clientActivityWorkbookRows(), firstLeaf = rows.find(row => row[0] === '2026-06')!
    firstLeaf[1] = value
    expect(() => buildSpreadsheetSheet('bad.xlsx', rows)).toThrow('Некоректний файл активності клієнтів')
  })
  it('keeps a numeric grouping key untouched and recognizes two count columns on the other axis', () => {
    const rows = clientActivityWorkbookRows()
    rows[3] = ['Рядки: Клієнт']; rows[4] = ['Колонки: По місяцях']
    const data = rows.findIndex(row => row[0] === '2026-06')
    rows.splice(data - 2, rows.length, ['Клієнт', '2026-06', '2026-07'], ['Клієнт', 'Активність клієнтів', 'Активність клієнтів'],
      ['Клієнт', CLIENT_ACTIVITY_COUNT_CAPTION, CLIENT_ACTIVITY_COUNT_CAPTION], [101, 1, 1], ['Загальний підсумок', 1, 1])
    const sheet = buildSpreadsheetSheet('cross.xlsx', rows)
    expect(sheet.rows[0].cells).toEqual([101, 1, 1])
    expect(getChartMeasureOptions(sheet).map(option => option.value)).toEqual(['1', '2'])
    expect(getAdditiveColumns(sheet)).toEqual([false, false, false])
    expect(getSpreadsheetNumberFormatter(sheet, 0)).toBeUndefined()
  })
})
