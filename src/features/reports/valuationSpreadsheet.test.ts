import { describe, expect, it } from 'vitest'
import { valuationHeaderLines, valuationWorkbookRows } from './data/valuationSpreadsheet.test-fixtures'
import { buildSpreadsheetChartData, getChartMeasureOptions } from './data/spreadsheetChartData'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, filterSheetRows, getAdditiveColumns,
  getSpreadsheetNumberFormatter, isCurrentStockSheet, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'

describe('valuation XLSX and CSV semantics', () => {
  const sheet = buildSpreadsheetSheet('Report', valuationWorkbookRows)

  it('retains exact agreement, VAT and publication metadata while formatting quantity8 separately from money2', () => {
    expect(isCurrentStockSheet(sheet)).toBe(true)
    expect(sheet.header?.lines).toEqual(valuationHeaderLines)
    expect(sheet.header?.warnings).toContain('! Покриття оцінки: 2 відомі, 1 невизначене значення')
    expect(getSpreadsheetNumberFormatter(sheet, 0)).toBeUndefined()
    expect(getSpreadsheetNumberFormatter(sheet, 2)?.format(0.00000001)).toBe('0,00000001')
    expect(getSpreadsheetNumberFormatter(sheet, 3)?.format(12.35)).toBe('12,35')
    expect(getSpreadsheetNumberFormatter(sheet, 3)?.format(0)).toBe('0,00')
    expect(getSpreadsheetNumberFormatter(sheet, 3, true)?.format(0)).toBe('0.00')
    expect(filterSheetRows(sheet, '', '2000-01-01', '2000-01-02')).toEqual(sheet.rows)
  })

  it('keeps unknown monetary totals blank and does not aggregate or round chart leaf quantities', () => {
    expect(getChartMeasureOptions(sheet).map(field => field.value)).toEqual(['2', '3'])
    expect(buildSpreadsheetChartData(sheet, sheet.rows, 2).points.map(point => point.value)).toEqual([0, 0.00000001, 2.12345678])
    expect(buildSpreadsheetChartData(sheet, sheet.rows, 3)).toMatchObject({ dataRowCount: 3, unknownCount: 1,
      points: [{ value: 0 }, { value: null }, { value: 12.35 }] })
    expect(getAdditiveColumns(sheet)).toEqual([false, false, false, false])
    expect(calculateTotals(sheet.rows, getAdditiveColumns(sheet))).toEqual([null, null, null, null])
  })

  it('preserves agreement context, unit identities, unknowns, zeros and money2 in filtered CSV', () => {
    const leaf = filterSheetRows(sheet, '[', '', '')
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, leaf))
    expect(csv).toContain('0.00000001')
    expect(csv).toContain('0.00')
    expect(csv).toContain('12.35')
    const imported = buildSpreadsheetSheet('valuation.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(imported.header).toEqual(sheet.header)
    expect(imported.rows.map(row => row.cells)).toEqual(leaf.map(row => row.cells.map(cell => cell ?? '')))
    expect(getAdditiveColumns(imported)).toEqual([false, false, false, false])
    expect(getSpreadsheetNumberFormatter(imported, 3)?.format(0)).toBe('0,00')
  })

  it('accepts the three mandatory main-sheet notes when long coverage/publication details move to Notes', () => {
    const rows = valuationWorkbookRows.filter((_, index) => index < 10 || index >= valuationHeaderLines.length)
    const compact = buildSpreadsheetSheet('Report', rows)
    expect(compact.header?.lines).toEqual(valuationHeaderLines.slice(0, 10))
    expect(compact.rows.filter(row => row.kind === 'data')).toHaveLength(3)
  })

  it.each([7, 8, 9])('refuses a valuation file missing required agreement context row%s', index => {
    const rows = structuredClone(valuationWorkbookRows)
    rows[index] = Array.from({ length: 4 }, () => '! Інша примітка')
    expect(buildSpreadsheetSheet('unrelated.xlsx', rows).header).toBeNull()
  })

  it('rejects a fuzzy title or different adjacent metadata and does not treat arbitrary CSV money captions as native quantity', () => {
    const rows = structuredClone(valuationWorkbookRows)
    rows[0] = Array.from({ length: 4 }, () => 'Оцінка поточних залишків за договором стороння')
    expect(buildSpreadsheetSheet('unrelated.xlsx', rows).header).toBeNull()
    rows[0] = valuationWorkbookRows[0]
    rows[7][1] = 'Чужі дані'
    expect(buildSpreadsheetSheet('unrelated.xlsx', rows).header).toBeNull()
    expect(buildSpreadsheetSheet('unrelated.csv', valuationWorkbookRows, 'flat').header).toBeNull()
    const arbitrary = buildSpreadsheetSheet('plain.csv', [['Код', 'Оцінка за договором, EUR'], [459018, 0.12345678]], 'flat')
    expect(getSpreadsheetNumberFormatter(arbitrary, 1)).toBeUndefined()
    expect(buildSheetExportRows(arbitrary, arbitrary.rows)[1][1]).toBe(0.12345678)
  })
})
