import { expect, it } from 'vitest'
import { accountBalanceHeaderLines, accountBalanceWorkbookRows } from './data/accountBalances.test-fixtures'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, getAdditiveColumns, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'

const notes = [
  '! Обсяг перевірки джерела: примітки про джерело описують усі факти до обмеження груп.',
  '! Обмеження груп: глобально за полем Рахунок, найбільші значення Записаний залишок рахунку; 50% від кількості груп, з округленням угору.',
  '! Результат обмеження груп: обрано 4 із 8 груп, залишено 4 із 9 рядків.',
  '! Підсумки після обмеження: лише факти залишених груп; стовпці збережено.',
]

it('preserves TOP scope/counts and every retained row in CSV, without reranking, applying percent twice or inventing a mixed grand', () => {
  const rows = structuredClone(accountBalanceWorkbookRows)
  rows.splice(accountBalanceHeaderLines.length, 0, ...notes.map(note => Array.from({ length: 5 }, () => note)))
  const sheet = buildSpreadsheetSheet('Report', rows)
  expect(sheet.header?.lines).toEqual([...accountBalanceHeaderLines, ...notes])
  expect(sheet.rows.map(row => row.kind)).toEqual(['data', 'data', 'subtotal', 'data', 'data', 'total'])
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  expect(restored.header).toEqual(sheet.header)
  expect(restored.rows).toEqual(sheet.rows.map(row => ({ ...row, cells: row.cells.map(cell => cell ?? '') })))
  expect(buildSpreadsheetChartData(restored, restored.rows, 4).points.map(point => point.value)).toEqual([0, 1234.56, -7.89, null])
  expect(calculateTotals(restored.rows, getAdditiveColumns(restored))).toEqual([null, null, null, null, null])
})
it('does not use a TOP note to skip unrelated CSV content or adjacent differing cells', () => {
  const rows = structuredClone(accountBalanceWorkbookRows)
  rows.splice(accountBalanceHeaderLines.length, 0, [notes[1], 'Значення користувача', null, null, null])
  expect(buildSpreadsheetSheet('Report', rows).header).toBeNull()
  expect(buildSpreadsheetSheet('CSV', [[notes[0], 'дані'], ['Група', 'Сума'], ['1', 7]], 'flat').header).toBeNull()
})
