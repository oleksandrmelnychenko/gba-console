import type { SpreadsheetSheet } from '../types'
export const CURRENT_VPARIVANIE_ANALYSIS_TITLE = 'Аналіз залишків і продажів: групування'
export const isCurrentVparivanieAnalysisSheet = (sheet: SpreadsheetSheet | null): boolean => sheet?.header?.lines[0] === CURRENT_VPARIVANIE_ANALYSIS_TITLE
export function validateCurrentVparivanieAnalysisSheet(sheet: SpreadsheetSheet): SpreadsheetSheet {
  if (!isCurrentVparivanieAnalysisSheet(sheet)) return sheet
  const count = sheet.header!.rowGroupings.length
  if (count < 1 || count > 8 || sheet.columns.length <= count || sheet.columns.length > count + 256
    || sheet.rows.length > 500000 || sheet.rows.length * sheet.columns.length > 1000000
    || !sheet.header!.lines.some(line => /^Період: \d{2}\.\d{2}\.\d{4} – \d{2}\.\d{2}\.\d{4}$/.test(line))
    || !sheet.header!.lines.includes('Показники: Результат')
    || sheet.columns.slice(count).some(c => c.split(' · ').at(-1) !== 'Результат'))
    throw new Error('Некоректна структура файлу групування аналізу залишків і продажів.')
  for (const row of sheet.rows) {
    if (row.kind !== 'data' || row.cells.length > sheet.columns.length || row.cells.slice(count).some(v => v != null && v !== '' && (typeof v !== 'number' || !Number.isFinite(v))))
      throw new Error('Некоректні кількості файлу аналізу залишків і продажів.')
    row.cells = Array.from({ length: sheet.columns.length }, (_, i) => i >= count && row.cells[i] === '' ? null : row.cells[i] ?? null)
  }
  return sheet
}
