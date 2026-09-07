import type { SpreadsheetRow, SpreadsheetSheet } from '../types'
import { parseNumericValue } from '../utils'

export const REPORT_CHART_ROW_LIMIT = 50

export type SpreadsheetChartPoint = { rowKey: string; label: string; value: number | null }

export function getChartMeasureOptions(sheet: SpreadsheetSheet) {
  const numericColumns = new Set<number>()
  if (!sheet.header) {
    for (const row of sheet.rows) {
      if (row.kind !== 'data') continue
      row.cells.forEach((cell, index) => { if (parseNumericValue(cell) !== null) numericColumns.add(index) })
    }
  }
  // A native report declares its grouping width. Every later column is a measure,
  // including a measure with no known values. Numeric article codes remain axes.
  const groupingWidth = sheet.header?.rowGroupings.length
  return sheet.columns.flatMap((label, index) =>
    (groupingWidth !== undefined ? index >= groupingWidth : numericColumns.has(index))
      ? [{ label, value: String(index) }] : [])
}

/** Each plotted point is one leaf row; no totals, ratios or repeated labels are combined. */
export function buildSpreadsheetChartData(sheet: SpreadsheetSheet, rows: SpreadsheetRow[], measurementIndex: number) {
  const points: SpreadsheetChartPoint[] = []
  let dataRowCount = 0
  let unknownCount = 0
  const groupingWidth = sheet.header?.rowGroupings.length
  for (const row of rows) {
    if (row.kind !== 'data') continue
    dataRowCount += 1
    if (points.length >= REPORT_CHART_ROW_LIMIT) continue
    const labelCells = groupingWidth !== undefined ? row.cells.slice(0, groupingWidth)
      : row.cells.slice(0, measurementIndex === 0 ? 0 : 1)
    const label = labelCells.flatMap(cell => { const text = String(cell ?? '').trim(); return text ? [text] : [] }).join(' · ') || `Рядок ${dataRowCount}`
    const value = parseNumericValue(row.cells[measurementIndex])
    if (value === null) unknownCount += 1
    points.push({ rowKey: `row-${dataRowCount}`, label, value })
  }
  return { points, dataRowCount, unknownCount, hiddenCount: dataRowCount - points.length }
}
