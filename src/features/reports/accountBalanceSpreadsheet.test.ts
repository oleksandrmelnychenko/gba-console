import { describe, expect, it } from 'vitest'
import { accountBalanceHeaderLines, accountBalanceWorkbookRows } from './data/accountBalances.test-fixtures'
import { buildSpreadsheetChartData, getChartMeasureOptions } from './data/spreadsheetChartData'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, filterSheetRows, getAdditiveColumns, getSpreadsheetNumberFormatter, isCurrentReportSheet, isCurrentStockSheet, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'

describe('account balances: four-axis current workbook, CSV and charts', () => {
  const sheet = buildSpreadsheetSheet('Report', accountBalanceWorkbookRows)
  it('retains all four axis identities, fixed cents, genuine zero and unknown independent balances', () => {
    expect(sheet.header?.rowGroupings).toEqual(['Призначення рахунку', 'Тип рахунку', 'Валюта рахунку', 'Рахунок'])
    expect(sheet.header?.lines).toEqual(accountBalanceHeaderLines)
    expect(isCurrentReportSheet(sheet)).toBe(true); expect(isCurrentStockSheet(sheet)).toBe(false)
    expect(sheet.rows.filter(row => row.kind === 'data').map(row => row.cells)).toEqual([
      ['Звичайний [1]', 'Готівковий [1]', 'UAH [2]', 'Рахунок [1000]', 0],
      ['Звичайний [1]', 'Готівковий [1]', 'UAH [2]', 'Рахунок [1001]', 1234.56],
      ['Звичайний [1]', 'Банківський [3]', 'EUR [1]', 'Рахунок [2000]', -7.89],
      ['Спільний [2]', 'Картковий [2]', 'Непідтверджена валюта', 'Рахунок [3000]', null],
    ])
    expect(getSpreadsheetNumberFormatter(sheet, 4)?.resolvedOptions()).toMatchObject({ minimumFractionDigits: 2, maximumFractionDigits: 2 })
    expect(getSpreadsheetNumberFormatter(sheet, 4)?.format(0)).toBe('0,00')
    expect(getSpreadsheetNumberFormatter(sheet, 3)).toBeUndefined()
    expect(filterSheetRows(sheet, '', '1900-01-01', '1900-01-02')).toEqual(sheet.rows)
  })
  it('exports all optional notes, literal zero and cents without manufacturing a mixed-currency total', () => {
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
    expect(csv).toContain('0.00'); expect(csv).toContain('1234.56'); expect(csv).toContain('-7.89')
    const imported = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(imported.header).toEqual(sheet.header)
    expect(imported.rows).toEqual(sheet.rows.map(row => ({ ...row, cells: row.cells.map(cell => cell ?? '') })))
    expect(calculateTotals(imported.rows, getAdditiveColumns(imported))).toEqual([null, null, null, null, null])
    const filtered = filterSheetRows(sheet, '[1000]', '', '')
    const subsetCsv = buildSpreadsheetCsv(buildSheetExportRows(sheet, filtered))
    const subset = buildSpreadsheetSheet('CSV', parseDelimitedText(subsetCsv, detectDelimiter(subsetCsv)), 'flat')
    expect(subset.header).toEqual(sheet.header); expect(subset.rows).toHaveLength(1); expect(subset.rows[0].cells[4]).toBe(0)
    expect(getAdditiveColumns(subset)).toEqual([false, false, false, false, false])
  })
  it('charts only leaf balances with all four identities and keeps an unknown gap distinct from zero', () => {
    expect(getChartMeasureOptions(sheet).map(field => field.value)).toEqual(['4'])
    const chart = buildSpreadsheetChartData(sheet, sheet.rows, 4)
    expect(chart.points.map(point => point.value)).toEqual([0, 1234.56, -7.89, null])
    expect(chart.unknownCount).toBe(1); expect(chart.dataRowCount).toBe(4)
    expect(chart.points[1].label).toBe('Звичайний [1] · Готівковий [1] · UAH [2] · Рахунок [1001]')
  })
  it.each([
    { index: 0, value: 'Записані залишки рахунків користувача' },
    { index: 1, value: 'Коментар: поточний стан' },
    { index: 2, value: 'Час читання (UTC): 08.09.2026' },
    { index: 1, value: 'Період: 01.06.2026 – 30.06.2026' },
  ])('refuses unproven current metadata row $index', ({ index, value }) => {
    const rows = structuredClone(accountBalanceWorkbookRows); rows[index] = Array.from({ length: 5 }, () => value)
    expect(buildSpreadsheetSheet('Unrelated', rows).header).toBeNull()
  })
  it('does not discard adjacent data or accept merged attribution in ordinary CSV', () => {
    const rows = structuredClone(accountBalanceWorkbookRows); rows[2][1] = 'Інше значення'
    expect(buildSpreadsheetSheet('Unrelated', rows).header).toBeNull()
    expect(buildSpreadsheetSheet('CSV', accountBalanceWorkbookRows, 'flat').header).toBeNull()
  })
})
