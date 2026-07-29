import { describe, expect, it } from 'vitest'
import {
  buildSheetExportRows,
  buildSpreadsheetSheet,
  calculateTotals,
  detectDelimiter,
  filterSheetRows,
  getAdditiveColumns,
  parseDelimitedText,
} from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'
import type { SpreadsheetCellValue } from './types'

// Transcribed from a sheet the report engine actually produced (rows «Товар» + «Month», measures
// «Кількість продажу» + «Вартість продажу»), read back exactly as read-excel-file hands it over: the merged
// header repeats its caption, a repeated «Товар» arrives as null, and the subtotal caption is repeated across
// the row-field columns it is merged over.
//
// The block above the table is the engine's attribution header: the period, the groupings of both axes, the
// measures and the filters, closed by one blank row. It is written in column A only, it carries no numbers, and
// it is what the viewer now finds the table by.
const engineSheet: SpreadsheetCellValue[][] = [
  ['Звіт продажів', null, null, null],
  ['Період: 01.08.2025 – 31.10.2025', null, null, null],
  ['Рядки: Товар, По місяцях', null, null, null],
  ['Колонки: —', null, null, null],
  ['Показники: Кількість продажів, Продажі без ПДВ', null, null, null],
  ['Фільтри: не застосовано', null, null, null],
  [null, null, null, null],
  [null, null, 'Кількість продажу, шт', 'Вартість продажу, EUR'],
  ['Товар', 'По місяцях', 'Кількість', 'Продажі без ПДВ'],
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

  it('starts the table under the attribution block instead of folding it into the header', () => {
    expect(sheet.columns).toEqual([
      'Товар',
      'По місяцях',
      'Кількість продажу, шт · Кількість',
      'Вартість продажу, EUR · Продажі без ПДВ',
    ])
  })

  it('keeps the attribution block, so the sheet still says which request it answers', () => {
    expect(sheet.header?.lines[0]).toBe('Звіт продажів')
    expect(sheet.header?.rowGroupings).toEqual(['Товар', 'По місяцях'])
    expect(sheet.header?.columnGroupings).toEqual([])
    expect(sheet.header?.warnings).toEqual([])
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
      ['Звіт продажів', null],
      ['Рядки: Артикул', null],
      ['Колонки: —', null],
      [null, null],
      [null, 'Кількість продажу, шт'],
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
      ['Звіт продажів', null, null],
      ['Рядки: Організація', null, null],
      ['Колонки: —', null, null],
      [null, null, null],
      [null, 'Вартість продажу, EUR', 'Рентабельність, %'],
      ['Організація', 'Продажі без ПДВ', 'Рентабельність без ПДВ, %'],
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

// A cost that was never recorded is not a cost of zero, so the engine leaves those cells EMPTY and says so at the
// top of the file. A report whose measures are all cost-derived therefore has data rows carrying no numbers at
// all — which is exactly what the old «first row holding a number» rule mistook for more header.
describe('buildSpreadsheetSheet — a report whose first rows have no numbers', () => {
  const sheet = buildSpreadsheetSheet('Report', [
    ['Звіт продажів', null, null],
    ['Період: 01.06.2026 – 30.06.2026', null, null],
    ['Рядки: Товар', null, null],
    ['Колонки: —', null, null],
    ['Показники: Собівартість без ПДВ, Рентабельність без ПДВ, %', null, null],
    ['Фільтри: не застосовано', null, null],
    [
      'Собівартість: немає даних — 8830 з 8830 клітинок не мають джерела собівартості (партія товару не '
      + 'списана), тому їх залишено порожніми: Собівартість без ПДВ, Рентабельність без ПДВ, %',
      null,
      null,
    ],
    [null, null, null],
    [null, 'Собівартість, EUR', 'Рентабельність, %'],
    ['Товар', 'Собівартість без ПДВ', 'Рентабельність без ПДВ, %'],
    ['Автолампа CHAMPION', null, null],
    ['Підсумок: Автолампа CHAMPION', null, null],
    ['Амортизатор', 12.5, 30],
    ['Підсумок: Амортизатор', 12.5, 30],
    ['Загальний підсумок', null, null],
  ])

  it('does not eat the first data row as header', () => {
    expect(sheet.columns).toEqual(['Товар', 'Собівартість, EUR · Собівартість без ПДВ', 'Рентабельність, % · Рентабельність без ПДВ, %'])
    expect(sheet.rows.filter((row) => row.kind === 'data').map((row) => row.cells[0]))
      .toEqual(['Автолампа CHAMPION', 'Амортизатор'])
  })

  it('leaves the empty cost cells empty rather than inheriting the row above', () => {
    expect(sheet.rows[0].cells).toEqual(['Автолампа CHAMPION', null, null])
  })

  it('surfaces the «немає даних» line as a warning, because it is why the column is blank', () => {
    expect(sheet.header?.warnings).toHaveLength(1)
    expect(sheet.header?.warnings[0]).toContain('немає даних')
  })

  it('adds up no column the engine itself left without a grand total', () => {
    expect(getAdditiveColumns(sheet)).toEqual([false, false, false])
  })
})

describe('buildSpreadsheetSheet — a column axis', () => {
  const sheet = buildSpreadsheetSheet('Report', [
    ['Звіт продажів', null, null, null, null],
    ['Період: 05.06.2026 – 06.06.2026', null, null, null, null],
    ['Рядки: Товар', null, null, null, null],
    ['Колонки: Повернення від клієнта', null, null, null, null],
    ['Показники: Кількість продажів', null, null, null, null],
    ['Фільтри: не застосовано', null, null, null, null],
    [null, null, null, null, null],
    ['Повернення від клієнта', 'Без повернення', 'Без повернення', 'К0000000121', 'К0000000121'],
    [null, 'Кількість продажу, шт', 'Вартість продажу, EUR', 'Кількість продажу, шт', 'Вартість продажу, EUR'],
    ['Товар', 'Кількість', 'Продажі без ПДВ', 'Кількість', 'Продажі без ПДВ'],
    ['Амортизатор', 2, 34.24, null, null],
    ['Підсумок: Амортизатор', 2, 34.24, null, null],
    ['Загальний підсумок', 2, 34.24, null, null],
  ])

  it('reads three header rows and does not title the row column after the column axis', () => {
    expect(sheet.columns).toEqual([
      'Товар',
      'Без повернення · Кількість продажу, шт · Кількість',
      'Без повернення · Вартість продажу, EUR · Продажі без ПДВ',
      'К0000000121 · Кількість продажу, шт · Кількість',
      'К0000000121 · Вартість продажу, EUR · Продажі без ПДВ',
    ])
  })

  it('reads the returns dimension off the block', () => {
    expect(sheet.header?.columnGroupings).toEqual(['Повернення від клієнта'])
  })
})

// A report that matched nothing. The engine says so in the block and prints a ONE-row table header — there are no
// measure columns to head — so this is the one shape where the header is SHALLOWER than the arithmetic the block
// implies (one column level none + the unit group + the measure = two). Finding the header by name is what gets it
// right; the arithmetic alone would swallow the grand-total row. Transcribed from a workbook the engine produced
// for 01–02.01.2019.
describe('buildSpreadsheetSheet — a report that matched nothing', () => {
  // One column wide, the way read-excel-file hands it over: an empty report has no measure columns at all.
  const sheet = buildSpreadsheetSheet('Report', [
    ['Звіт продажів'],
    ['Період: 01.01.2019 – 02.01.2019'],
    ['Рядки: Організація'],
    ['Колонки: —'],
    ['Показники: Кількість продажів, Продажі без ПДВ'],
    ['Фільтри: не застосовано'],
    ['За вибраними умовами даних не знайдено'],
    [null],
    ['Організація'],
    ['Загальний підсумок'],
  ])

  it('keeps the one-row header and does not eat the total row into it', () => {
    expect(sheet.columns).toEqual(['Організація'])
    expect(sheet.rows.map((row) => row.kind)).toEqual(['total'])
  })

  it('shows «нічого не знайдено» as a warning, so an empty page is not mistaken for a broken one', () => {
    expect(sheet.header?.warnings).toEqual(['За вибраними умовами даних не знайдено'])
  })
})

// The same grouping down the side and across the top. Degenerate, and legal — the report screen offers it and
// the engine answers it — and it is the one layout where column A carries the row-field caption TWICE: once at
// the top of the header, naming what the captions across the sheet are, and once on the last header row, naming
// the column beneath it. Transcribed from a workbook the engine produced (rows «Організація», columns
// «Організація», 30.06.2026), read back the way read-excel-file hands it over.
//
// Finding the header by taking the FIRST row whose column A says «Організація» stopped on the top one and fed
// two header rows to the table as data, so «Кількість продажу, шт» appeared as a group with «Кількість» beneath
// it. The rule is the DEEPEST match inside the header depth the block itself implies.
describe('buildSpreadsheetSheet — the same grouping on both axes', () => {
  const sheet = buildSpreadsheetSheet('Report', [
    ['Звіт продажів', null, null, null, null],
    ['Період: 30.06.2026 – 30.06.2026', null, null, null, null],
    ['Рядки: Організація', null, null, null, null],
    ['Колонки: Організація', null, null, null, null],
    ['Показники: Кількість продажів, Продажі без ПДВ', null, null, null, null],
    ['Фільтри: не застосовано', null, null, null, null],
    [null, null, null, null, null],
    ['Організація', 'ТОВ «АМГ «КОНКОРД»', 'ТОВ «АМГ «КОНКОРД»', 'Фенікс', 'Фенікс'],
    [null, 'Кількість продажу, шт', 'Вартість продажу, EUR', 'Кількість продажу, шт', 'Вартість продажу, EUR'],
    ['Організація', 'Кількість', 'Продажі без ПДВ', 'Кількість', 'Продажі без ПДВ'],
    ['ТОВ «АМГ «КОНКОРД»', 1648, 13395.44, null, null],
    ['Підсумок: ТОВ «АМГ «КОНКОРД»', 1648, 13395.44, null, null],
    ['Фенікс', null, null, 596, 3183.68],
    ['Підсумок: Фенікс', null, null, 596, 3183.68],
    ['Загальний підсумок', 1648, 13395.44, 596, 3183.68],
  ])

  it('reads all three header rows, not just the first one that answers to the row-field caption', () => {
    expect(sheet.columns).toEqual([
      'Організація',
      'ТОВ «АМГ «КОНКОРД» · Кількість продажу, шт · Кількість',
      'ТОВ «АМГ «КОНКОРД» · Вартість продажу, EUR · Продажі без ПДВ',
      'Фенікс · Кількість продажу, шт · Кількість',
      'Фенікс · Вартість продажу, EUR · Продажі без ПДВ',
    ])
  })

  it('starts the body at the first organization and keeps no header row in it', () => {
    expect(sheet.rows.filter((row) => row.kind === 'data').map((row) => row.cells[0]))
      .toEqual(['ТОВ «АМГ «КОНКОРД»', 'Фенікс'])
  })

  it('adds the data rows up to the engine’s own grand total', () => {
    const dataRows = sheet.rows.filter((row) => row.kind === 'data')

    expect(calculateTotals(dataRows, getAdditiveColumns(sheet)))
      .toEqual([null, 1648, 13395.44, 596, 3183.68])
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

describe('buildSheetExportRows', () => {
  const sheet = buildSpreadsheetSheet('Report', engineSheet)

  it('carries the attribution block into the CSV, so the export says what it answers', () => {
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))

    expect(csv.split('\n')[0]).toBe('Звіт продажів')
    expect(csv).toContain('Період: 01.08.2025 – 31.10.2025')
    expect(csv).toContain('"Рядки: Товар, По місяцях"')
    expect(csv).toContain('Товар,По місяцях,"Кількість продажу, шт · Кількість"')
  })

  it('appends the viewer’s own «Разом» when the sheet’s totals were filtered away', () => {
    const filtered = filterSheetRows(sheet, 'Автолампа CHAMPION', '', '')
    const totals = calculateTotals(filtered, getAdditiveColumns(sheet))
    const rows = buildSheetExportRows(sheet, filtered, ['Разом', '', totals[2] ?? '', totals[3] ?? ''])

    expect(rows[rows.length - 1]).toEqual(['Разом', '', 116, 15.5])
  })

  it('writes no attribution block for a file that never had one', () => {
    const plain = buildSpreadsheetSheet('plain.csv', [['Клієнт', 'Сума'], ['ТОВ Ромашка', 1000]])

    expect(buildSheetExportRows(plain, plain.rows)).toEqual([['Клієнт', 'Сума'], ['ТОВ Ромашка', 1000]])
  })
})

describe('buildSpreadsheetSheet — plain delimited file', () => {
  const csv = ['Клієнт,Дата,Сума', 'ТОВ Ромашка,2026-01-15,1000', ',2026-02-15,250'].join('\n')
  const sheet = buildSpreadsheetSheet('plain.csv', parseDelimitedText(csv, detectDelimiter(csv)))

  it('still reads one header row and treats every row as data', () => {
    expect(sheet.columns).toEqual(['Клієнт', 'Дата', 'Сума'])
    expect(sheet.rows.map((row) => row.kind)).toEqual(['data', 'data'])
    expect(sheet.header).toBeNull()
  })

  it('does not carry values into a genuinely empty cell', () => {
    expect(sheet.rows[1].cells[0]).toBe('')
  })

  it('totals every column that holds numbers, having no engine total to defer to', () => {
    expect(calculateTotals(sheet.rows, getAdditiveColumns(sheet))).toEqual([null, null, 1250])
  })
})

// A workbook saved before the engine started recording its request still has to open.
describe('buildSpreadsheetSheet — a report file written before the attribution block', () => {
  const sheet = buildSpreadsheetSheet('Report', [
    ['Товар', 'Кількість продажу', 'Вартість продажу'],
    ['Товар', 'Кількість', 'SalesValueWithoutVAT'],
    ['Аварийное соединение', 1, 0.82],
    ['Підсумок: Аварийное соединение', 1, 0.82],
    ['Загальний підсумок', 1, 0.82],
  ])

  it('falls back to the reading that file was written for', () => {
    expect(sheet.header).toBeNull()
    expect(sheet.columns).toEqual([
      'Товар',
      'Кількість продажу · Кількість',
      'Вартість продажу · SalesValueWithoutVAT',
    ])
    expect(sheet.rows.map((row) => row.kind)).toEqual(['data', 'subtotal', 'total'])
  })
})
