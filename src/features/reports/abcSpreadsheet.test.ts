import { expect, it } from 'vitest'
import { valuationHeaderLines } from './data/valuationSpreadsheet.test-fixtures'
import { accountBalanceHeaderLines } from './data/accountBalances.test-fixtures'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, getAdditiveColumns, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'
import type { SpreadsheetCellValue } from './types'

const notes = [
  '! ABC-класифікація: глобально за рахунком, показник Записаний залишок рахунку, після TOP.',
  '! Обсяг ABC: 3 ключі, 4 рядки; A: 1, B: 1, C: 1.',
  '! Межі ABC: 50/30/20, накопичення до поточної групи; рівні значення — за ключем.',
  '! Підсумки ABC: усі залишені факти та загальний підсумок збережено.',
]
const header = [...accountBalanceHeaderLines.slice(0, 3), 'Рядки: ABC-клас, Рахунок, Запис залишку рахунку', 'Колонки: —',
  'Показники: Записаний залишок рахунку', 'Фільтри: —', ...notes]
const rows: SpreadsheetCellValue[][] = [
  ...header.map(line => Array.from({ length: 4 }, () => line)), [],
  ['ABC-клас', 'Рахунок', 'Запис залишку рахунку', 'Залишки рахунків'],
  ['ABC-клас', 'Рахунок', 'Запис залишку рахунку', 'Записаний залишок рахунку'],
  ['A', 'Рахунок [2]', 'Запис [21]', 30],
  ['', '', 'Запис [22]', 30],
  ['Підсумок: Рахунок [2]', '', '', 60],
  ['Підсумок: A', '', '', 60],
  ['B', 'Рахунок [10]', 'Запис [23]', 50],
  ['Підсумок: B', '', '', 50],
  ['C', 'Рахунок [11]', 'Запис [24]', 0],
  ['Підсумок: C', '', '', 0],
  ['Загальний підсумок', '', '', 110],
]
it('preserves server class membership, repeated details, class subtotals and true zero across XLSX-style/CSV/chart without recomputing ABC', () => {
  const sheet = buildSpreadsheetSheet('Report', rows)
  expect(sheet.header?.lines).toEqual(header)
  expect(sheet.rows.map(row => row.kind)).toEqual(['data', 'data', 'subtotal', 'subtotal', 'data', 'subtotal', 'data', 'subtotal', 'total'])
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  expect(restored.header).toEqual(sheet.header)
  expect(restored.rows).toEqual(sheet.rows.map(row => ({ ...row, cells: row.cells.map(cell => cell ?? '') })))
  const chart = buildSpreadsheetChartData(restored, restored.rows, 3)
  expect(chart.points.map(point => point.value)).toEqual([30, 30, 50, 0])
  expect(chart.points.map(point => point.label)).toEqual(expect.arrayContaining([expect.stringContaining('A'), expect.stringContaining('B'), expect.stringContaining('C')]))
  expect(restored.rows.filter(row => row.kind === 'total').map(row => row.cells[3])).toEqual([110])
})
it('preserves independently unknown valuation amounts while quantity-ranked classes and known zeros stay intact', () => {
  const valuationHeader = [...valuationHeaderLines.map(line => line.startsWith('Рядки:') ? 'Рядки: ABC-клас, Склад, Одиниця виміру' : line),
    '! ABC-класифікація: за складом, показник Фізичний залишок; 50/30/20.',
    '! Підсумки ABC: усі залишені факти збережено.']
  const valuationRows: SpreadsheetCellValue[][] = [
    ...valuationHeader.map(line => Array.from({ length: 5 }, () => line)), [],
    ['ABC-клас', 'Склад', 'Одиниця виміру', 'Поточна оцінка залишків', 'Поточна оцінка залишків'],
    ['ABC-клас', 'Склад', 'Одиниця виміру', 'Фізичний залишок', 'Оцінка за договором, EUR'],
    ['A', 'Склад [10]', 'шт [10761]', 2, null], ['Підсумок: A', '', '', 2, null],
    ['B', 'Склад [20]', 'шт [10761]', 1, 1.89], ['Підсумок: B', '', '', 1, 1.89],
    ['C', 'Склад [30]', 'шт [10761]', 0, 0], ['Підсумок: C', '', '', 0, 0],
    ['Загальний підсумок', '', '', 3, null],
  ]
  const sheet = buildSpreadsheetSheet('Report', valuationRows), csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  expect(restored.header?.lines).toEqual(valuationHeader)
  expect(buildSpreadsheetChartData(restored, restored.rows, 3).points.map(point => point.value)).toEqual([2, 1, 0])
  expect(buildSpreadsheetChartData(restored, restored.rows, 4).points.map(point => point.value)).toEqual([null, 1.89, 0])
  expect(calculateTotals(restored.rows.filter(row => row.kind === 'data'), getAdditiveColumns(restored))).toEqual([null, null, null, 3, null])
  expect(restored.rows.find(row => row.kind === 'total')?.cells.slice(3)).toEqual([3, ''])
})
it('does not attribute arbitrary ABC text or conflicting adjacent metadata cells to a native report', () => {
  expect(buildSpreadsheetSheet('CSV', [[notes[0], 'дані'], ['Клас', 'Сума'], ['A', 7]], 'flat').header).toBeNull()
  const conflicting = structuredClone(rows); conflicting[7][1] = 'Користувацькі дані'
  expect(buildSpreadsheetSheet('Report', conflicting).header).toBeNull()
})
