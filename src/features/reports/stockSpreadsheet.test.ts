import { describe, expect, it } from 'vitest'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, filterSheetRows, getAdditiveColumns,
  isCurrentStockSheet, parseDelimitedText, stockQuantityFormatter } from './spreadsheet'
import { stockHeaderLines, stockWorkbookRows } from './data/stockSpreadsheet.test-fixtures'
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
