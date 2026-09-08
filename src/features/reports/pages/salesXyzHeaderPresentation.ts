import { XYZ_NOTE_PREFIXES } from '../data/salesXyzSpreadsheet'
import type { SpreadsheetReportHeader } from '../types'

const boundaries = ['Період:', 'Час читання (UTC):', 'Параметри запиту:',
  'Рядки:', 'Колонки:', 'Показники:', 'Фільтри:', 'Сортування:', 'Стан звіту:', 'УВАГА', '• ', '- ', ...XYZ_NOTE_PREFIXES]
const content = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const boundary = (line: string) => !line.trim() || line.trimStart().startsWith('!') || boundaries.some(prefix => line.trimStart().startsWith(prefix))

/** Only source15 display joins its nine notes. The raw workbook rows remain unchanged for CSV attribution. */
export function salesXyzHeaderPresentation(header: SpreadsheetReportHeader): Pick<SpreadsheetReportHeader, 'lines' | 'warnings'> {
  const rawWarnings = new Set(header.warnings), rawLines = new Set(header.lines)
  const lines: string[] = [], warnings: string[] = []
  for (let index = 0; index < header.lines.length; index += 1) {
    const first = header.lines[index], parts = [first]
    let warning = rawWarnings.has(first)
    if (XYZ_NOTE_PREFIXES.some(prefix => content(first).startsWith(prefix))) {
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
