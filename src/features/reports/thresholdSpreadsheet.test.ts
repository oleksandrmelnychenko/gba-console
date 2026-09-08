import { expect, it } from 'vitest'
import { accountBalanceHeaderLines } from './data/accountBalances.test-fixtures'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { buildSheetExportRows, buildSpreadsheetSheet, detectDelimiter, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'
import type { SpreadsheetCellValue } from './types'

const notes = [
  '! Обсяг перевірки джерела перед порогом: покриття описує початкові факти після звичайних відборів.',
  '! Поріг: 20% точної суми після TOP; звичайні відбори збережено.',
  '! Результат порогу: окремо 2 ключі; об’єднано 3 ключі.',
  '! Група Інше: «Інше (поріг)» — синтетична група; відбору за нею немає.',
  '! Підсумки після порогу: усі початкові внески враховано рівно один раз.',
]
const header = [...accountBalanceHeaderLines.slice(0, 3), 'Рядки: ABC-клас, Рахунок', 'Колонки: —',
  'Показники: Записаний залишок рахунку', 'Фільтри: Валюта рахунку = EUR', ...notes]
const rows: SpreadsheetCellValue[][] = [
  ...header.map(line => [line, line, line]), [],
  ['ABC-клас', 'Рахунок', 'Залишки рахунків'], ['ABC-клас', 'Рахунок', 'Записаний залишок рахунку'],
  ['A', 'Інше (поріг) [42]', 70], ['Підсумок: A', '', 70],
  ['B', 'Рахунок [7]', 30], ['Підсумок: B', '', 30],
  ['C', 'Інше (поріг)', 12.02], ['Підсумок: C', '', 12.02],
  ['Загальний підсумок', '', 112.02],
]
it('preserves server Other identity, original native names, notes and totals through XLSX-style/CSV/chart without client folding', () => {
  const sheet = buildSpreadsheetSheet('Report', rows)
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  expect(restored.header?.lines).toEqual(header)
  expect(restored.rows.filter(row => row.kind === 'data').map(row => row.cells)).toEqual([
    ['A', 'Інше (поріг) [42]', 70], ['B', 'Рахунок [7]', 30], ['C', 'Інше (поріг)', 12.02],
  ])
  const chart = buildSpreadsheetChartData(restored, restored.rows, 2)
  expect(chart.points.map(point => point.value)).toEqual([70, 30, 12.02])
  expect(chart.points[0].label).toContain('[42]')
  expect(chart.points[2].label).not.toContain('[42]')
  expect(restored.rows.filter(row => row.kind === 'subtotal').map(row => row.cells[2])).toEqual([70, 30, 12.02])
  expect(restored.rows.find(row => row.kind === 'total')?.cells[2]).toBe(112.02)
})
it('does not classify arbitrary threshold prose or conflicting neighboring metadata cells as native output', () => {
  expect(buildSpreadsheetSheet('CSV', [[notes[1], 'user data'], ['name', 'value'], ['Інше (поріг)', 7]], 'flat').header).toBeNull()
  const bad = structuredClone(rows); bad[7][1] = 'Окремі дані користувача'
  expect(buildSpreadsheetSheet('Report', bad).header).toBeNull()
})
