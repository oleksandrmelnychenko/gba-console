import { expect, it } from 'vitest'
import type { SpreadsheetCellValue } from '../types'
import { buildSheetExportRows, buildSpreadsheetSheet, getAdditiveColumns, parseDelimitedText, supportsSpreadsheetDateFilters } from '../spreadsheet'
import { CURRENT_VPARIVANIE_ANALYSIS_TITLE } from './currentVparivanieAnalysisSpreadsheet'
const rows = (): SpreadsheetCellValue[][] => [[CURRENT_VPARIVANIE_ANALYSIS_TITLE], ['Період: 01.10.2026 – 23.10.2026'],
  ['Рядки: Артикул, Товар, Місяць'], ['Колонки: Показник'], ['Показники: Результат'], [],
  [null,null,null,'Залишок на кінець періоду','Продажі у відборі','Прихід'],
  [null,null,null,'Кількість','Кількість','Кількість'],
  ['Артикул','Товар','Місяць','Результат','Результат','Результат'],
  ['000001','Товар\nопис','Не застосовується',5,null,0], ['000001','Товар\nопис','2026-10',null,3,0.00000001]]
it('keeps dynamic axes, sparse unknowns and non-additive sales branches through workbook and CSV', () => {
  const sheet = buildSpreadsheetSheet('Analysis', rows())
  expect(sheet.columns.slice(0,3)).toEqual(['Артикул','Товар','Місяць'])
  expect(sheet.rows.map(r => r.cells.slice(3))).toEqual([[5,null,0],[null,3,0.00000001]])
  expect(getAdditiveColumns(sheet)).toEqual(Array(6).fill(false))
  expect(supportsSpreadsheetDateFilters(sheet)).toBe(false)
  const output = buildSheetExportRows(sheet,sheet.rows)
  const csv = output.map(row => row.map(v => v == null ? '' : '"' + String(v).replaceAll('"','""') + '"').join(';')).join('\n')
  const restored = buildSpreadsheetSheet('Analysis', parseDelimitedText(csv,';'),'flat')
  expect(restored.rows).toEqual(sheet.rows)
  expect(() => buildSheetExportRows(sheet,sheet.rows,Array(6).fill(0))).toThrow('додавання')
})
it('rejects a text quantity instead of converting unavailable evidence into zero', () => {
  const input = rows(); input[9][3] = 'unknown'
  expect(() => buildSpreadsheetSheet('Analysis',input)).toThrow('кількості')
})
