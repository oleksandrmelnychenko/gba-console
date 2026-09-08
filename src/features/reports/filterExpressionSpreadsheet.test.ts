import { describe, expect, it } from 'vitest'
import { accountBalanceHeaderLines, accountBalanceWorkbookRows } from './data/accountBalances.test-fixtures'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, getAdditiveColumns, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'

const logic = '! Логіка відбору: ((Валюта рахунку Дорівнює UAH [2]) І ((Рахунок Дорівнює Рахунок [1000]) АБО (Рахунок Дорівнює Рахунок [1001]))).'

describe('filter expression attribution in generated workbooks and CSV', () => {
  it('preserves the fully bracketed server logic as metadata, leaf order, true zero, unknowns and authoritative mixed grand', () => {
    const rows = structuredClone(accountBalanceWorkbookRows)
    rows.splice(accountBalanceHeaderLines.length, 0, Array.from({ length: 5 }, () => logic))
    const sheet = buildSpreadsheetSheet('Report', rows)
    expect(sheet.header?.lines).toContain(logic)
    expect(sheet.rows.map(row => row.kind)).toEqual(['data', 'data', 'subtotal', 'data', 'data', 'total'])
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
    const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(restored.header).toEqual(sheet.header)
    expect(restored.rows).toEqual(sheet.rows.map(row => ({ ...row, cells: row.cells.map(cell => cell ?? '') })))
    expect(calculateTotals(restored.rows, getAdditiveColumns(restored))).toEqual([null, null, null, null, null])
    expect(buildSpreadsheetChartData(restored, restored.rows, 4).points.map(point => point.value)).toEqual([0, 1234.56, -7.89, null])
  })
  it('does not discard adjacent differing user data or attribute unrelated sheets from the new prefix', () => {
    const rows = structuredClone(accountBalanceWorkbookRows)
    rows.splice(accountBalanceHeaderLines.length, 0, [logic, 'Дані користувача', null, null, null])
    expect(buildSpreadsheetSheet('Report', rows).header).toBeNull()
    expect(buildSpreadsheetSheet('CSV', [[logic, 'дані'], ['Рахунок', 'Сума'], ['1', 7]], 'flat').header).toBeNull()
  })
})
