import { describe, expect, it } from 'vitest'
import {
  buildSpreadsheetSheet,
  calculateTotals,
  detectDelimiter,
  filterSheetRows,
  getAdditiveColumns,
  parseDelimitedText,
} from './spreadsheet'
import type { SpreadsheetCellValue } from './types'

// Transcribed from a sheet the report engine actually produced (rows «Товар» + «Month», measures
// «Кількість продажу» + «Вартість продажу»), read back exactly as read-excel-file hands it over: the merged
// header repeats its caption, a repeated «Товар» arrives as null, and the subtotal caption is repeated across
// the row-field columns it is merged over.
const engineSheet: SpreadsheetCellValue[][] = [
  ['Товар', 'Month', 'Кількість продажу', 'Вартість продажу'],
  ['Товар', 'Month', 'Кількість', 'SalesValueWithoutVAT'],
  ['Аварийное соединение', 'Серпень 2025', 1, 0.82],
  ['Підсумок: Аварийное соединение', 'Підсумок: Аварийное соединение', 1, 0.82],
  ['Автолампа CHAMPION', 'Серпень 2025', 20, 5.3],
  [null, 'Вересень 2025', 26, 3.5],
  [null, 'Жовтень 2025', 70, 6.7],
  ['Підсумок: Автолампа CHAMPION', 'Підсумок: Автолампа CHAMPION', 116, 15.5],
  ['Загальний підсумок', 'Загальний підсумок', 117, 16.32],
]

describe('buildSpreadsheetSheet — report engine sheet', () => {
  const sheet = buildSpreadsheetSheet('Report', engineSheet)

  it('reads the whole multi-row header instead of stopping at its first line', () => {
    expect(sheet.columns).toEqual([
      'Товар',
      'Month',
      'Кількість продажу · Кількість',
      'Вартість продажу · SalesValueWithoutVAT',
    ])
  })

  it('carries a merged grouping value down the rows it covers', () => {
    const groups = sheet.rows.filter((row) => row.kind === 'data').map((row) => row.cells[0])

    expect(groups).toEqual([
      'Аварийное соединение',
      'Автолампа CHAMPION',
      'Автолампа CHAMPION',
      'Автолампа CHAMPION',
    ])
  })

  it('tells subtotal and grand-total rows apart from data', () => {
    expect(sheet.rows.map((row) => row.kind)).toEqual([
      'data',
      'subtotal',
      'data',
      'data',
      'data',
      'subtotal',
      'total',
    ])
  })

  it('drops the caption repeated across the columns a total row is merged over', () => {
    expect(sheet.rows.find((row) => row.kind === 'total')?.cells)
      .toEqual(['Загальний підсумок', null, 117, 16.32])
  })

  it('totals the data rows only, matching the sheet’s own grand total', () => {
    const dataRows = sheet.rows.filter((row) => row.kind === 'data')

    expect(calculateTotals(dataRows, getAdditiveColumns(sheet))).toEqual([null, null, 117, 16.32])
  })

  it('leaves grouping columns out of the totals even when their values parse as numbers', () => {
    const numericGroups = buildSpreadsheetSheet('Report', [
      ['Артикул', 'Кількість продажу'],
      ['Артикул', 'Кількість'],
      [39999, 10],
      ['Підсумок: 39999', 20],
      [70001, 5],
      ['Підсумок: 70001', 5],
      ['Загальний підсумок', 15],
    ])

    expect(getAdditiveColumns(numericGroups)).toEqual([false, true])
  })

  it('leaves a ratio column out of the totals, because the sheet does not add it up either', () => {
    const withRatio = buildSpreadsheetSheet('Report', [
      ['Організація', 'Вартість продажу', 'Рентабельність'],
      ['Організація', 'SalesValueWithoutVAT', 'ProfitabilityPercentWithoutVAT'],
      ['Фенікс', 200, 100],
      ['Підсумок: Фенікс', 200, 100],
      ['ТОВ «АМГ «КОНКОРД»', 300, 100],
      ['Підсумок: ТОВ «АМГ «КОНКОРД»', 300, 100],
      ['Загальний підсумок', 500, 100],
    ])
    const dataRows = withRatio.rows.filter((row) => row.kind === 'data')

    expect(calculateTotals(dataRows, getAdditiveColumns(withRatio))).toEqual([null, 500, null])
  })
})

describe('filterSheetRows', () => {
  const sheet = buildSpreadsheetSheet('Report', engineSheet)

  it('keeps the engine’s own total rows while nothing is filtered', () => {
    expect(filterSheetRows(sheet, '', '', '')).toBe(sheet.rows)
  })

  it('drops the engine’s total rows once a filter narrows the sheet', () => {
    const filtered = filterSheetRows(sheet, 'Автолампа CHAMPION', '', '')

    expect(filtered).toHaveLength(3)
    expect(filtered.every((row) => row.kind === 'data')).toBe(true)
    // the carried grouping value is what makes the whole group findable, not just its first row
    expect(filtered.map((row) => row.cells[1])).toEqual(['Серпень 2025', 'Вересень 2025', 'Жовтень 2025'])
  })

  it('totals the filtered selection to the engine’s own subtotal for that group', () => {
    const filtered = filterSheetRows(sheet, 'Автолампа CHAMPION', '', '')

    expect(calculateTotals(filtered, getAdditiveColumns(sheet))).toEqual([null, null, 116, 15.5])
  })
})

describe('buildSpreadsheetSheet — plain delimited file', () => {
  const csv = ['Клієнт,Дата,Сума', 'ТОВ Ромашка,2026-01-15,1000', ',2026-02-15,250'].join('\n')
  const sheet = buildSpreadsheetSheet('plain.csv', parseDelimitedText(csv, detectDelimiter(csv)))

  it('still reads one header row and treats every row as data', () => {
    expect(sheet.columns).toEqual(['Клієнт', 'Дата', 'Сума'])
    expect(sheet.rows.map((row) => row.kind)).toEqual(['data', 'data'])
  })

  it('does not carry values into a genuinely empty cell', () => {
    expect(sheet.rows[1].cells[0]).toBe('')
  })

  it('totals every column that holds numbers, having no engine total to defer to', () => {
    expect(calculateTotals(sheet.rows, getAdditiveColumns(sheet))).toEqual([null, null, 1250])
  })
})
