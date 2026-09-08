import { BUYER_SALES_SHARE_NOTE_PREFIXES } from '../data/buyerSalesShareSpreadsheet'
import type { SpreadsheetReportHeader } from '../types'

const boundaries = ['Поточний період:', 'Період порівняння:', 'Час читання (UTC):', 'Параметри запиту:',
  'Рядки:', 'Колонки:', 'Показники:', 'Фільтри:', 'Сортування:', 'Стан звіту:', 'УВАГА', '• ', '- ', ...BUYER_SALES_SHARE_NOTE_PREFIXES]
const content = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const boundary = (line: string) => !line.trim() || line.trimStart().startsWith('!') || boundaries.some(prefix => line.trimStart().startsWith(prefix))

/** Only source17 display joins its eight notes. The raw workbook rows remain unchanged for CSV attribution. */
export function buyerSalesShareHeaderPresentation(header: SpreadsheetReportHeader): Pick<SpreadsheetReportHeader, 'lines' | 'warnings'> {
  const rawWarnings = new Set(header.warnings), rawLines = new Set(header.lines)
  const lines: string[] = [], warnings: string[] = []
  for (let index = 0; index < header.lines.length; index += 1) {
    const first = header.lines[index], parts = [first]
    let warning = rawWarnings.has(first)
    if (BUYER_SALES_SHARE_NOTE_PREFIXES.some(prefix => content(first).startsWith(prefix))) {
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
