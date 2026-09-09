import { isPaymentComparisonSheet, paymentComparisonColumn, PAYMENT_COMPARISON_NOTE_PREFIXES } from '../data/paymentComparisonSpreadsheet'
import type { SpreadsheetReportHeader, SpreadsheetSheet } from '../types'

const boundaries = ['Поточний період:', 'Період порівняння:', 'Час читання (UTC):', 'Параметри запиту:',
  'Рядки:', 'Колонки:', 'Показники:', 'Фільтри:', 'Сортування:', 'Стан звіту:', 'УВАГА', '• ', '- ', ...PAYMENT_COMPARISON_NOTE_PREFIXES]
const content = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const boundary = (line: string) => !line.trim() || line.trimStart().startsWith('!') || boundaries.some(prefix => line.trimStart().startsWith(prefix))

/** Only source21 display joins its eight notes. The raw workbook rows remain unchanged for CSV attribution. */
export function paymentComparisonHeaderPresentation(header: SpreadsheetReportHeader): Pick<SpreadsheetReportHeader, 'lines' | 'warnings'> {
  const rawWarnings = new Set(header.warnings), rawLines = new Set(header.lines)
  const lines: string[] = [], warnings: string[] = []
  for (let index = 0; index < header.lines.length; index += 1) {
    const first = header.lines[index], parts = [first]
    let warning = rawWarnings.has(first)
    if (PAYMENT_COMPARISON_NOTE_PREFIXES.some(prefix => content(first).startsWith(prefix))) {
      while (index + 1 < header.lines.length && !boundary(header.lines[index + 1])) {
        index += 1
        parts.push(header.lines[index])
        warning ||= rawWarnings.has(header.lines[index])
      }
    }
    const line = parts.join(' ')
    lines.push(line)
    if (warning) warnings.push(line)
  }
  warnings.push(...header.warnings.filter(line => !rawLines.has(line)))
  return { lines, warnings }
}

const tableCaptions = ['Поточна сума', 'Попередня сума', 'Зміна суми', 'Відносна зміна, %']

/** Display labels only: full native captions remain in the sheet, tooltip and export. */
export function paymentComparisonTableCaption(sheet: SpreadsheetSheet, column: string): string | null {
  return isPaymentComparisonSheet(sheet) ? tableCaptions[paymentComparisonColumn(column)] ?? null : null
}
