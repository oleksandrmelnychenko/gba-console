import { describe, expect, it } from 'vitest'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, filterSheetRows, getAdditiveColumns,
  isCurrentStockSheet, parseDelimitedText, stockQuantityFormatter } from './spreadsheet'
import { stockHeaderLines, stockWorkbookRows, placementWorkbookRows, reservationWorkbookRows } from './data/stockSpreadsheet.test-fixtures'
import { buildSpreadsheetCsv } from './utils'
import { buildSpreadsheetChartData, getChartMeasureOptions } from './data/spreadsheetChartData'

describe('current stock native XLSX and CSV presentation', () => {
  const sheet = buildSpreadsheetSheet('Report', stockWorkbookRows)

  it('reads the explicit current snapshot timestamps and merged stock captions, retaining unknowns, zero and eight decimals', () => {
    expect(isCurrentStockSheet(sheet)).toBe(true)
    expect(sheet.header?.lines).toEqual(stockHeaderLines)
    expect(sheet.header?.rowGroupings).toEqual(['Склад', 'Одиниця виміру'])
    expect(sheet.columns).toEqual(['Склад', 'Одиниця виміру',
      'Поточні залишки · Фізичний залишок', 'Поточні залишки · Вільна кількість', 'Поточні залишки · Записаний резерв'])
    expect(sheet.rows.filter(row => row.kind === 'data').map(row => row.cells)).toEqual([
      ['Основний [10]', 'шт [10761]', null, 0, 0.00000001],
      ['Основний [10]', 'м [10780]', 0, null, 0],
      ['Резервний [20]', 'шт [10761]', 2.12345678, 1, null],
    ])
    expect(getAdditiveColumns(sheet)).toEqual([false, false, false, false, false])
    expect(stockQuantityFormatter.format(0.00000001)).toBe('0,00000001')
    expect(stockQuantityFormatter.format(0)).toBe('0')
    expect(filterSheetRows(sheet, '', '2020-01-01', '2020-01-02')).toEqual(sheet.rows)
  })

  it.each([
    ['missing current state', 1, 'Коментар: поточний стан'],
    ['missing UTC identity', 2, 'Час читання: 07.09.2026'],
    ['similar title', 0, 'Звіт поточних складських залишків сторонній'],
    ['historical period', 1, 'Період: 01.06.2026 – 30.06.2026'],
  ])('refuses unrelated stock-like metadata: %s', (_, index, value) => {
    const rows = structuredClone(stockWorkbookRows)
    rows[Number(index)] = Array.from({ length: 5 }, () => value)
    expect(buildSpreadsheetSheet('other.xlsx', rows).header).toBeNull()
  })

  it('refuses unrelated adjacent data and merged repetitions in an ordinary CSV', () => {
    const rows = structuredClone(stockWorkbookRows)
    rows[2][1] = 'Інша дата'
    expect(buildSpreadsheetSheet('other.xlsx', rows).header).toBeNull()
    expect(buildSpreadsheetSheet('other.csv', stockWorkbookRows, 'flat').header).toBeNull()
  })

  it('round-trips actual exported CSV without inventing totals or losing unit identities and read times', () => {
    const leaf = filterSheetRows(sheet, '[', '', '')
    expect(leaf).toHaveLength(3)
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, leaf))
    const imported = buildSpreadsheetSheet('stock.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(imported.header).toEqual(sheet.header)
    expect(imported.rows.every(row => row.kind === 'data')).toBe(true)
    expect(imported.rows.map(row => row.cells)).toEqual(leaf.map(row => row.cells.map(cell => cell ?? '')))
    expect(calculateTotals(imported.rows, getAdditiveColumns(imported))).toEqual([null, null, null, null, null])
  })

  it('plots separate warehouse/unit leaf points, with gaps for absent source records and actual zero unchanged', () => {
    expect(getChartMeasureOptions(sheet).map(option => option.value)).toEqual(['2', '3', '4'])
    expect(buildSpreadsheetChartData(sheet, sheet.rows, 2)).toMatchObject({ dataRowCount: 3, unknownCount: 1,
      points: [
        { label: 'Основний [10] · шт [10761]', value: null },
        { label: 'Основний [10] · м [10780]', value: 0 },
        { label: 'Резервний [20] · шт [10761]', value: 2.12345678 },
      ] })
    expect(buildSpreadsheetChartData(sheet, sheet.rows, 4).points.map(point => point.value)).toEqual([0.00000001, 0, null])
  })
})


describe.each([
  { source: 5, rows: placementWorkbookRows, dimensionCount: 5, values: [0, null, 0.00000001] },
  { source: 6, rows: reservationWorkbookRows, dimensionCount: 4, values: [1, 0.00000001, 0] },
])('current stock slice $source XLSX and CSV', ({ rows, dimensionCount, values }) => {
  const sheet = buildSpreadsheetSheet('Report', rows)

  it('retains explicit read times, structural identity, actual zero and unknowns across XLSX/CSV/chart transformations', () => {
    expect(isCurrentStockSheet(sheet)).toBe(true)
    expect(sheet.header?.lines[2]).toBe(stockHeaderLines[2])
    const leaf = sheet.rows.filter(row => row.kind === 'data')
    expect(leaf).toHaveLength(3)
    expect(leaf.map(row => row.cells[dimensionCount])).toEqual(values)
    const chart = buildSpreadsheetChartData(sheet, sheet.rows, dimensionCount)
    expect(chart.dataRowCount).toBe(3)
    expect(chart.points.map(point => point.value)).toEqual(values)
    expect(chart.unknownCount).toBe(values.filter(value => value === null).length)
    expect(new Set(chart.points.map(point => point.label)).size).toBe(3)
    expect(getChartMeasureOptions(sheet).map(field => field.value)).toEqual([String(dimensionCount)])
    expect(getAdditiveColumns(sheet).every(value => !value)).toBe(true)
    expect(filterSheetRows(sheet, '', '1900-01-01', '1900-01-02')).toEqual(sheet.rows)
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, leaf))
    const imported = buildSpreadsheetSheet('slice.csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(imported.header).toEqual(sheet.header)
    expect(imported.rows.map(row => row.cells.map((cell, index) => index < dimensionCount ? String(cell) : cell)))
      .toEqual(leaf.map(row => row.cells.map((cell, index) => index < dimensionCount ? String(cell) : cell ?? '')))
    expect(buildSpreadsheetChartData(imported, imported.rows, dimensionCount).points.map(point => point.label))
      .toEqual(chart.points.map(point => point.label))
    expect(getAdditiveColumns(imported).every(value => !value)).toBe(true)
    expect(buildSpreadsheetChartData(imported, imported.rows, dimensionCount).points.map(point => point.value)).toEqual(values)
    expect(csv).toContain('0.00000001')
  })

  it.each([
    { index: 0, value: 'Звіт поточних резервів за договорами сторонній' },
    { index: 1, value: 'Коментар: поточний стан' },
    { index: 2, value: 'Час читання (UTC): 07.09.2026' },
    { index: 1, value: 'Період: 01.06.2026 – 30.06.2026' },
  ])('rejects invalid native metadata row $index', ({ index, value }) => {
    const invalid = structuredClone(rows)
    invalid[index] = Array.from({ length: dimensionCount + 1 }, () => value)
    expect(buildSpreadsheetSheet('unrelated.xlsx', invalid).header).toBeNull()
  })

  it('does not discard unrelated adjacent cells or attribute an ordinary merged CSV', () => {
    const invalid = structuredClone(rows)
    invalid[2][1] = 'Інші операційні дані'
    expect(buildSpreadsheetSheet('unrelated.xlsx', invalid).header).toBeNull()
    expect(buildSpreadsheetSheet('unrelated.csv', rows, 'flat').header).toBeNull()
  })
})
