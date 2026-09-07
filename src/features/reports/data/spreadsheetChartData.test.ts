import { describe, expect, it } from 'vitest'
import type { SpreadsheetRow, SpreadsheetSheet } from '../types'
import { buildSpreadsheetChartData, getChartMeasureOptions } from './spreadsheetChartData'

const sheet: SpreadsheetSheet = { name: 'Звіт', columns: ['Клієнт', 'Договір', 'Сума, EUR', 'Рентабельність, %'],
  header: { rowGroupings: ['Клієнт', 'Договір'], columnGroupings: [], lines: [], warnings: [] },
  rows: [
    { kind: 'data', cells: ['Клієнт А', 42, 120, 10] },
    { kind: 'data', cells: ['Клієнт А', 43, null, 50] },
    { kind: 'subtotal', cells: ['Підсумок: Клієнт А', null, 120, 20] },
    { kind: 'data', cells: ['Клієнт Б', 44, 0, null] },
    { kind: 'total', cells: ['Загальний підсумок', null, 120, 20] },
  ],
}

describe('spreadsheet chart facts', () => {
  it('excludes subtotal and total rows and keeps unknown values distinct from zero', () => {
    const result = buildSpreadsheetChartData(sheet, sheet.rows, 2)
    expect(result.points).toEqual([
      { rowKey: 'row-1', label: 'Клієнт А · 42', value: 120 },
      { rowKey: 'row-2', label: 'Клієнт А · 43', value: null },
      { rowKey: 'row-3', label: 'Клієнт Б · 44', value: 0 },
    ])
    expect(result).toMatchObject({ dataRowCount: 3, unknownCount: 1, hiddenCount: 0 })
  })

  it('does not add percentages or combine repeated captions', () => {
    const repeated = [sheet.rows[0], { ...sheet.rows[1], cells: ['Клієнт А', 42, null, 50] }]
    const { points } = buildSpreadsheetChartData(sheet, repeated, 3)
    expect(points.map(point => point.value)).toEqual([10, 50])
    expect(points.map(point => point.label)).toEqual(['Клієнт А · 42', 'Клієнт А · 42'])
    expect(new Set(points.map(point => point.rowKey)).size).toBe(2)
  })

  it('excludes numeric grouping columns and retains an entirely unknown native measure', () => {
    const unknown = { ...sheet, rows: [{ kind: 'data' as const, cells: ['Клієнт А', 42, null, null] }] }
    expect(getChartMeasureOptions(unknown)).toEqual([
      { label: 'Сума, EUR', value: '2' }, { label: 'Рентабельність, %', value: '3' },
    ])
    expect(buildSpreadsheetChartData(unknown, unknown.rows, 2).points[0].value).toBeNull()
  })

  it('preserves blank/invalid values as gaps, including a blank before the first number', () => {
    const rows = [null, '', '-', 'невідомо', Number.POSITIVE_INFINITY, 0, '-12,5'].map(value => ({
      kind: 'data' as const, cells: ['Клієнт', 42, value],
    }))
    expect(buildSpreadsheetChartData(sheet, rows, 2).points.map(point => point.value)).toEqual([null, null, null, null, null, 0, -12.5])
  })

  it('limits the first 50 leaf rows in current table order without counting totals', () => {
    const rows: SpreadsheetRow[] = Array.from({ length: 55 }, (_, index) => ([
      { kind: 'data' as const, cells: ['Клієнт', index, index] },
      { kind: 'subtotal' as const, cells: ['Підсумок', null, 999] },
    ])).flat()
    const result = buildSpreadsheetChartData(sheet, rows, 2)
    expect(result.points).toHaveLength(50)
    expect(result.points[49].value).toBe(49)
    expect(result).toMatchObject({ dataRowCount: 55, hiddenCount: 5 })
  })

  it('offers only data-backed numeric columns in an arbitrary imported table', () => {
    const imported: SpreadsheetSheet = { name: 'CSV', header: null, columns: ['Назва', 'Сума', 'Тільки підсумок'], rows: [
      { kind: 'data', cells: ['Клієнт А', '1 234,5', null] },
      { kind: 'total', cells: ['Разом', 1234.5, 999] },
    ] }
    expect(getChartMeasureOptions(imported)).toEqual([{ label: 'Сума', value: '1' }])
  })
})
