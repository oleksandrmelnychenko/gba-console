import { expect, it } from 'vitest'
import controls from './data/marginComparison.oracle-vectors.json'
import { marginRows } from './data/marginComparison.test-fixtures'
import { MARGIN_COMPARISON_EMPTY_STATE } from './data/marginComparisonSpreadsheet'
import { buildSpreadsheetSheet, getAdditiveColumns, getSpreadsheetNumberFormatter, buildSheetExportRows, parseDelimitedText, detectDelimiter } from './spreadsheet'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { buildSpreadsheetCsv } from './utils'
import type { SpreadsheetCellValue } from './types'

it.each(controls)('preserves independent Fraction oracle margins, selected order, nulls and weighted totals: $id', control => {
  const selected = control.selectedFields.map(field => field - 55)
  const raw = marginRows('known', selected), body = raw.findIndex(row => row[0] === 'Клієнт' && row[1] === 'Договір') + 1
  raw.splice(body)
  const date = (value: string) => value.split('-').reverse().join('.')
  raw[1] = ['Поточний період: '+date(control.request.currentFrom)+' – '+date(control.request.currentTo)]
  raw[2] = ['Період порівняння: '+date(control.request.previousFrom)+' – '+date(control.request.previousTo)]
  if (control.groups.every(group => group.kind === 'grand')) raw.splice(body - 3,0,[MARGIN_COMPARISON_EMPTY_STATE])
  const rowCells = control.groups.map(group => [group.kind === 'grand' ? 'Загальний підсумок' : group.kind === 'client' ? `Підсумок: Клієнт [${group.clientId}]` : `Клієнт [${group.clientId}]`,group.kind === 'contract' ? `Договір [${group.clientAgreementId}]` : null,...group.values.map(value=>value===null?null:Number(value))] satisfies SpreadsheetCellValue[])
  raw.push(...rowCells)
  const sheet = buildSpreadsheetSheet(control.id,raw)
  expect(sheet.rows.map(row=>row.cells)).toEqual(rowCells)
  expect(getAdditiveColumns(sheet).every(value=>!value)).toBe(true)
  for (const [rowIndex,group] of control.groups.entries()) for (const [offset,expected] of group.values.entries()) {
    const value = sheet.rows[rowIndex].cells[offset+2]
    expect(value===null?null:getSpreadsheetNumberFormatter(sheet,offset+2,true)!.format(Number(value))).toBe(expected)
  }
  for (const offset of selected.keys()) expect(buildSpreadsheetChartData(sheet,sheet.rows,offset+2).points.map(point=>point.value)).toEqual(control.groups.filter(group=>group.kind==='contract').map(group=>group.values[offset]===null?null:Number(group.values[offset])))
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet,sheet.rows))
  const reloaded = buildSpreadsheetSheet('CSV',parseDelimitedText(csv,detectDelimiter(csv)),'flat')
  const canonical = (rows:typeof sheet.rows)=>rows.map(row=>({kind:row.kind,cells:row.cells.map(cell=>cell??'')}))
  expect(canonical(reloaded.rows)).toEqual(canonical(sheet.rows))
  expect(reloaded.header).toEqual(sheet.header)
})
