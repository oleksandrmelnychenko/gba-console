import { describe, expect, it } from 'vitest'
import { accountBalanceHeaderLines, accountBalanceWorkbookRows } from './data/accountBalances.test-fixtures'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, getAdditiveColumns, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'
import type { SpreadsheetCellValue } from './types'

const orderingNote = '! Сортування: рядки, «Рахунок» — за підсумком «Записаний залишок рахунку» за всіма стовпцями, за спаданням; порожні значення наприкінці. Порядок діє в межах батьківської групи.'
const sortedWorkbook: SpreadsheetCellValue[][] = [
  ...accountBalanceHeaderLines.map(line => Array.from({ length: 5 }, () => line)),
  Array.from({ length: 5 }, () => orderingNote), [],
  ...accountBalanceWorkbookRows.slice(accountBalanceHeaderLines.length + 1, accountBalanceHeaderLines.length + 3),
  ['Звичайний [1]', 'Готівковий [1]', 'UAH [2]', 'Рахунок [1001]', 1234.56],
  ['', '', '', 'Рахунок [1000]', 0],
  ['Підсумок: UAH [2]', '', '', '', 1234.56],
  ['Звичайний [1]', 'Банківський [3]', 'EUR [1]', 'Рахунок [2000]', -7.89],
  ['Спільний [2]', 'Картковий [2]', 'Непідтверджена валюта', 'Рахунок [3000]', null],
  ['Загальний підсумок', '', '', '', null],
]

describe('server ordering in workbook, CSV and charts', () => {
  it('preserves server sibling order, group boundaries and sorting notes without recomputing totals', () => {
    const sheet = buildSpreadsheetSheet('Report', sortedWorkbook)
    expect(sheet.header?.lines).toContain(orderingNote)
    expect(sheet.rows.map(row => row.kind)).toEqual(['data', 'data', 'subtotal', 'data', 'data', 'total'])
    expect(sheet.rows.map(row => row.cells[4])).toEqual([1234.56, 0, 1234.56, -7.89, null, null])
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
    const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(restored.header).toEqual(sheet.header)
    expect(restored.rows).toEqual(sheet.rows.map(row => ({ ...row, cells: row.cells.map(cell => cell ?? '') })))
    expect(calculateTotals(restored.rows, getAdditiveColumns(restored))).toEqual([null, null, null, null, null])
    const chart = buildSpreadsheetChartData(restored, restored.rows, 4)
    expect(chart.points.map(point => point.value)).toEqual([1234.56, 0, -7.89, null])
    expect(chart.points[0].label).toContain('Рахунок [1001]')
    expect(chart.points[1].label).toContain('Рахунок [1000]')
    expect(chart.unknownCount).toBe(1)
  })

  it('does not use a sorting prefix to discard neighboring user data or classify unrelated CSV', () => {
    const conflicting = structuredClone(sortedWorkbook)
    conflicting[accountBalanceHeaderLines.length][1] = 'Дані користувача'
    expect(buildSpreadsheetSheet('Report', conflicting).header).toBeNull()
    expect(buildSpreadsheetSheet('CSV', [[orderingNote, 'дані'], ['Рахунок', 'Сума'], ['1', 7]], 'flat').header).toBeNull()
  })
})
