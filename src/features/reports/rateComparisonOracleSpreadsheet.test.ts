import { expect, it } from 'vitest'
import vectors from './data/rateComparison.oracle-vectors.json'
import { RATE_COMPARISON_CAPTIONS } from './data/rateComparison'
import { rateRows } from './data/rateComparison.test-fixtures'
import { buildSheetExportRows, buildSpreadsheetSheet, getAdditiveColumns, getSpreadsheetNumberFormatter, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { buildSpreadsheetCsv } from './utils'
// These values come from the independent Python Fraction oracle, not console arithmetic.
const date = (value: string) => value.split('-').toReversed().join('.')
const point = (value: { id: string; created: string; amount: string } | null) => value ? `HistoryID=${value.id}; дата=${value.created}; курс=${value.amount}` : 'відсутній'
it.each(vectors)('preserves independent display vector $id through import, chart and CSV', vector => {
  const fields = vector.selectedFields.map(field => field - 51), raw = rateRows('known', fields)
  raw[1] = ['Поточна дата: ' + date(vector.currentAsOf)]; raw[2] = ['Дата порівняння: ' + date(vector.previousAsOf)]
  raw[8] = [`! Джерело звіту: GBA, набір 19; збережена історія курсів. Поточна дата: ${vector.currentAsOf}; дата порівняння: ${vector.previousAsOf}.`]
  raw[9] = ['! Валютна пара: ' + vector.caption]; raw[10] = ['! Поточний запис: ' + point(vector.points.current)]; raw[11] = ['! Запис порівняння: ' + point(vector.points.previous)]
  raw[raw.length - 1] = [vector.caption, ...vector.values.map(value => value == null ? null : Number(value))]
  const sheet = buildSpreadsheetSheet(vector.id, raw)
  expect(getAdditiveColumns(sheet).some(Boolean)).toBe(false); expect(sheet.rows).toHaveLength(1)
  const restored = buildSpreadsheetSheet(vector.id, parseDelimitedText(buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows)), ','), 'flat')
  vector.values.forEach((expected, offset) => {
    const column = offset + 1, value = restored.rows[0].cells[column]
    expect(value == null || value === '' ? null : getSpreadsheetNumberFormatter(restored, column, true)?.format(Number(value))).toBe(expected)
    expect(buildSpreadsheetChartData(restored, restored.rows, column).points[0]).toMatchObject({ label: vector.caption, value: expected == null ? null : Number(expected) })
    expect(restored.columns[column]).toBe(`Історичні курси · ${RATE_COMPARISON_CAPTIONS[fields[offset]]}`)
  })
})
