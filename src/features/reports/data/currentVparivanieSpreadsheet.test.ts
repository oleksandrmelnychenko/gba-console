import { expect, it } from 'vitest'
import type { SpreadsheetCellValue } from '../types'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, CURRENT_VPARIVANIE_TITLE } from './currentVparivanie'
import { CURRENT_VPARIVANIE_DISPLAY_LINE } from './currentVparivanieSpreadsheet'
import { buildSheetExportRows, buildSpreadsheetSheet, getAdditiveColumns, getSpreadsheetNumberFormatter, parseDelimitedText, supportsSpreadsheetDateFilters } from '../spreadsheet'

function rows(): SpreadsheetCellValue[][] {
  return [[CURRENT_VPARIVANIE_TITLE], ['Період: 01.09.2026 – 27.09.2026'], ['Рядки: Товар'],
    ['Колонки: Группа, Контрагент'], ['Показники: Результат'], [CURRENT_VPARIVANIE_DISPLAY_LINE], [],
    [null,null,null,null,null,null,null,'Остатки','Продажи','Контрагенты','Контрагенты'],
    [null,null,null,null,null,null,null,'','', 'Same caption', 'Same caption'],
    [null,null,null,null,null,null,null,'Кількість','Кількість','Кількість','Кількість'],
    [...CURRENT_VPARIVANIE_PRODUCT_CAPTIONS,'Результат','Результат','Результат','Результат'],
    ['0000123','Name','first description','group',null,'123','Так',0,-2,null,0.00000001],
    [null,'Other','',null,null,null,null,null,3,null,null]]
}
it('keeps seven flat display columns separate from one semantic Product axis and sparse quantities', () => {
  const sheet = buildSpreadsheetSheet('Матриця', rows())
  expect(sheet.header?.lines).toContain('Рядки: Товар')
  expect(sheet.columns.slice(0,7)).toEqual(CURRENT_VPARIVANIE_PRODUCT_CAPTIONS)
  expect(sheet.rows).toHaveLength(2)
  expect(sheet.rows[1].cells).toEqual([null,'Other','',null,null,null,null,null,3,null,null])
  expect(sheet.rows[0].cells.slice(7)).toEqual([0,-2,null,0.00000001])
  expect(getAdditiveColumns(sheet)).toEqual(Array(11).fill(false))
  expect(supportsSpreadsheetDateFilters(sheet)).toBe(false)
  expect(getSpreadsheetNumberFormatter(sheet,0)).toBeUndefined()
  expect(getSpreadsheetNumberFormatter(sheet,7,true)?.format(0.00000001)).toBe('0.00000001')
})
it('round trips exact digit-only text and quoted multiline attrs without browser totals', () => {
  const input = rows(); input[11][2] = 'line1\nline2'
  const sheet = buildSpreadsheetSheet('Матриця', input)
  const exportRows = buildSheetExportRows(sheet, sheet.rows)
  const csv = exportRows.map(row => row.map(cell => cell == null ? '' : `"${String(cell).replaceAll('"','""')}"`).join(';')).join('\n')
  const restored = buildSpreadsheetSheet('Матриця', parseDelimitedText(csv, ';'), 'flat')
  expect(restored.rows[0].cells.slice(0,7)).toEqual(['0000123','Name','line1\nline2','group','','123','Так'])
  expect(restored.rows[0].cells.slice(7)).toEqual([0,-2,null,0.00000001])
  expect(() => buildSheetExportRows(sheet,sheet.rows,Array(11).fill(0))).toThrow('підсумки')
})
it.each(['display-missing','display-duplicate','measure-legacy','period-missing','numeric-attr','text-quantity','total'])('rejects invalid current matrix file %s', kind => {
  const input = rows()
  if (kind === 'display-missing') input.splice(5,1)
  if (kind === 'display-duplicate') input.splice(5,0,[CURRENT_VPARIVANIE_DISPLAY_LINE])
  if (kind === 'measure-legacy') input[4] = ['Показники: Остатки, Продажи, Контрагенты']
  if (kind === 'period-missing') input[1] = ['Період: невідомий']
  if (kind === 'numeric-attr') input[11][0] = 123
  if (kind === 'text-quantity') input[11][7] = 'unknown-as-zero'
  if (kind === 'total') input.push(['Загальний підсумок',null,null,null,null,null,null,5])
  expect(() => buildSpreadsheetSheet('Матриця',input)).toThrow('Некоректний файл')
})
