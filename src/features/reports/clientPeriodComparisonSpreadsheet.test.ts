import { describe, expect, it } from 'vitest'
import { buildSheetExportRows, buildSpreadsheetSheet, detectDelimiter, filterSheetRows, getAdditiveColumns, getSpreadsheetNumberFormatter, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'
import { clientComparisonRows } from './data/clientPeriodComparison.test-fixtures'
import { CLIENT_COMPARISON_CAPTIONS } from './data/clientPeriodComparison'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { getReportHeaderPresentation } from './pages/reportHeaderPresentation'
const parseCsv = (value: string) => parseDelimitedText(value, detectDelimiter(value))

describe('source13 files preserve union calculations and selected measure types', () => {
  it('keeps authoritative 3/2/1/50 totals despite leaf 2/1/1/100 twice', () => {
    const sheet = buildSpreadsheetSheet('Clients', clientComparisonRows())
    expect(sheet.rows.at(-1)?.cells).toEqual(['Загальний підсумок', 3, 2, 1, 50])
    expect(getAdditiveColumns(sheet)).toEqual([false, false, false, false, false])
    expect(getSpreadsheetNumberFormatter(sheet, 4)?.format(2.34)).toBe('2,34')
    expect(getSpreadsheetNumberFormatter(sheet, 3)?.format(-2)).toBe('-2')
    expect(buildSpreadsheetChartData(sheet, sheet.rows, 4).points.map(point => point.value)).toEqual([100, 100])
  })
  it.each(['current-unknown', 'previous-unknown'] as const)('keeps %s independent through CSV, local filters and charts', kind => {
    const sheet = buildSpreadsheetSheet('Clients', clientComparisonRows(kind))
    const roundtrip = buildSpreadsheetSheet('CSV', parseCsv(buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))), 'flat')
    expect(roundtrip.rows.map(row => row.cells)).toEqual(sheet.rows.map(row => row.cells.map(cell => cell ?? '')))
    const filtered = filterSheetRows(sheet, '103', '', '')
    expect(filtered.map(row => row.kind)).toEqual(['data'])
    expect(buildSpreadsheetChartData(sheet, filtered, 4).points[0].value).toBeNull()
    const csv = buildSpreadsheetSheet('filtered', parseCsv(buildSpreadsheetCsv(buildSheetExportRows(sheet, filtered))), 'flat')
    expect(csv.rows.every(row => row.kind === 'data')).toBe(true)
    expect(getAdditiveColumns(csv).every(value => !value)).toBe(true)
  })
  it.each(Array.from({ length: 15 }, (_, index) => index + 1))('keeps complete-empty selected subset %s and its state coherent', mask => {
    const selected = [0, 1, 2, 3].filter(index => mask & (1 << index))
    const sheet = buildSpreadsheetSheet('Empty', clientComparisonRows('empty', selected))
    expect(sheet.rows).toHaveLength(1)
    expect(sheet.rows[0].cells).toEqual(['Загальний підсумок', ...selected.map(index => index === 3 ? 100 : 0)])
    const rows = filterSheetRows(sheet, 'not found', '', '')
    expect(rows).toBe(sheet.rows)
    const roundtrip = buildSpreadsheetSheet('CSV', parseCsv(buildSpreadsheetCsv(buildSheetExportRows(sheet, rows))), 'flat')
    expect(roundtrip.rows).toEqual(sheet.rows)
  })
  it('rejects a wrong derived scalar, fractional count, excess percentage precision and a mismatched caption', () => {
    for (const [column, value] of [[1, 1.2], [3, 99], [4, 100.000001], [4, null]] as const) {
      const rows = clientComparisonRows(); rows[rows.length - 1][column] = value
      expect(() => buildSpreadsheetSheet('Bad', rows)).toThrow(/Некоректний файл/)
    }
    const rows = clientComparisonRows(); rows[rows.length - 5][4] = CLIENT_COMPARISON_CAPTIONS[1]
    expect(() => buildSpreadsheetSheet('Bad', rows)).toThrow()
  })
  it('rejects duplicated or missing context and joins all eight physical note continuations only for display', () => {
    const rows = clientComparisonRows(); rows.splice(9, 0, ['продовження з усіма причинами.', 'продовження з усіма причинами.'])
    const sheet = buildSpreadsheetSheet('Wrapped', rows)
    const presentation = getReportHeaderPresentation(sheet.header!)
    expect(presentation.lines.some(line => line.includes('продовження з усіма причинами.'))).toBe(true)
    expect(presentation.lines.length).toBe(sheet.header!.lines.length - 1)
    for (const bad of [clientComparisonRows().filter((_, index) => index !== 2), [...clientComparisonRows().slice(0, 2), clientComparisonRows()[1], ...clientComparisonRows().slice(2)]]) {
      expect(() => buildSpreadsheetSheet('Bad', bad)).toThrow(/Некоректний файл/)
    }
  })
})
