import { expect, it } from 'vitest'
import controls from './data/paymentComparison.oracle-vectors.json'
import { paymentRows } from './data/paymentComparison.test-fixtures'
import { PAYMENT_COMPARISON_EMPTY_STATE, paymentComparisonNotes } from './data/paymentComparisonSpreadsheet'
import { getPaymentChartCurrencyScope } from './data/importedPaymentsChartCurrency'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { buildSheetExportRows, buildSpreadsheetSheet, detectDelimiter, getAdditiveColumns, getSpreadsheetNumberFormatter, parseDelimitedText } from './spreadsheet'
import type { SpreadsheetCellValue } from './types'
import { buildSpreadsheetCsv } from './utils'

it.each(controls)('preserves independent raw payment oracle: $id', control => {
  const raw = paymentRows('known', control.selectedFields.map(field => field - 59))
  const body = raw.findIndex(row => row[0] === 'Валюта рахунку') + 1
  raw.splice(body)
  const date = (value: string) => value.split('-').reverse().join('.')
  raw[1] = [`Поточний період: ${date(control.current.from)} – ${date(control.current.to)}`]
  raw[2] = [`Період порівняння: ${date(control.comparison.from)} – ${date(control.comparison.to)}`]
  const direction = raw.findIndex(row => String(row[0]).startsWith('! Напрям платежів:'))
  raw[direction] = [`! ${paymentComparisonNotes(control.direction as 1 | 2)[1]}`]
  if (!control.groups.length) raw.splice(body - 3, 0, [PAYMENT_COMPARISON_EMPTY_STATE])
  const caption = (name: string, id: string | null) => id === null ? 'Невідомо' : `${name} [${id}]`
  const cells = control.groups.map(group => [
    group.kind === 'grand' ? 'Загальний підсумок' : `${group.kind === 'currency' ? 'Підсумок: ' : ''}${caption('Валюта', group.currencyId)}`,
    group.kind === 'grand' || group.kind === 'currency' ? '' : `${group.kind === 'client' ? 'Підсумок: ' : ''}${caption('Клієнт', group.clientId)}`,
    group.kind === 'contract' ? caption('Договір', group.clientAgreementId) : '',
    ...group.values.map(value => value === null ? null : Number(value)),
  ] satisfies SpreadsheetCellValue[])
  raw.push(...cells)
  const sheet = buildSpreadsheetSheet(control.id, raw)
  expect(sheet.rows.map(row => row.cells)).toEqual(cells)
  expect(sheet.rows.filter(row => row.kind === 'data')).toHaveLength(control.rowCount)
  expect(getAdditiveColumns(sheet).some(Boolean)).toBe(false)
  for (const [rowIndex, group] of control.groups.entries()) for (const [offset, expected] of group.values.entries()) {
    const value = sheet.rows[rowIndex].cells[offset + 3]
    expect(value === null ? null : getSpreadsheetNumberFormatter(sheet, offset + 3, true)!.format(Number(value))).toBe(expected)
  }
  for (const offset of control.selectedFields.keys()) {
    const scope = getPaymentChartCurrencyScope(sheet, sheet.rows, offset + 3)
    for (const [currencyId, rows] of scope.rowsByCurrency) {
      const expected = control.groups.filter(group => group.kind === 'contract' && group.currencyId === currencyId)
        .map(group => group.values[offset] === null ? null : Number(group.values[offset]))
      expect(buildSpreadsheetChartData(sheet, rows, offset + 3).points.map(point => point.value)).toEqual(expected)
    }
  }
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  const canonical = (rows: typeof sheet.rows) => rows.map(row => ({ kind: row.kind, cells: row.cells.map(cell => cell ?? '') }))
  expect(canonical(restored.rows)).toEqual(canonical(sheet.rows)); expect(restored.header).toEqual(sheet.header)
})
