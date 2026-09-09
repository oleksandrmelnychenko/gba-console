import { RETURN_COMPARISON_TITLE } from '../data/returnComparison'
import { returnComparisonHeaderPresentation } from './returnComparisonHeaderPresentation'
import { BUYER_SALES_SHARE_TITLE } from '../data/buyerSalesShare'
import { buyerSalesShareHeaderPresentation } from './buyerSalesShareHeaderPresentation'
import { REVENUE_COMPARISON_TITLE } from '../data/revenueComparison'
import { revenueComparisonHeaderPresentation } from './revenueComparisonHeaderPresentation'
import { XYZ_TITLE } from '../data/salesXyz'
import { salesXyzHeaderPresentation } from './salesXyzHeaderPresentation'
import { IMPORTED_PAYMENTS_TITLE } from '../data/importedPayments'
import { importedPaymentsHeaderPresentation } from './importedPaymentsHeaderPresentation'
import { CLIENT_COMPARISON_TITLE } from '../data/clientPeriodComparison'
import { clientComparisonHeaderPresentation } from './clientComparisonHeaderPresentation'
import { CLIENT_ACTIVITY_NOTE_PREFIXES, CLIENT_ACTIVITY_REPORT_TITLE } from '../data/clientActivityReport'
import type { SpreadsheetReportHeader } from '../types'

const metadataPrefixes = ['Період:', 'Час читання (UTC):', 'Поточний стан:', 'Параметри запиту:',
  'Рядки:', 'Колонки:', 'Показники:', 'Фільтри:', 'Сортування:', 'Стан звіту:',
  'Собівартість:', 'ПДВ:', 'Докладні примітки:', 'УВАГА', '• ', '- ', ...CLIENT_ACTIVITY_NOTE_PREFIXES]
const noteText = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const isBoundary = (line: string) => !line.trim() || line.trimStart().startsWith('!')
  || metadataPrefixes.some(prefix => line.trimStart().startsWith(prefix))

/** Join only the five native client notes for display. Raw attribution and CSV retain physical writer rows. */
export function getReportHeaderPresentation(header: SpreadsheetReportHeader): Pick<SpreadsheetReportHeader, 'lines' | 'warnings'> {
  if (header.lines[0] === RETURN_COMPARISON_TITLE) return returnComparisonHeaderPresentation(header)
  if (header.lines[0] === BUYER_SALES_SHARE_TITLE) return buyerSalesShareHeaderPresentation(header)
  if (header.lines[0] === REVENUE_COMPARISON_TITLE) return revenueComparisonHeaderPresentation(header)
  if (header.lines[0] === XYZ_TITLE) return salesXyzHeaderPresentation(header)
  if (header.lines[0] === IMPORTED_PAYMENTS_TITLE) return importedPaymentsHeaderPresentation(header)
  if (header.lines[0] === CLIENT_COMPARISON_TITLE) return clientComparisonHeaderPresentation(header)
  if (header.lines[0] !== CLIENT_ACTIVITY_REPORT_TITLE) return header
  const originalWarnings = new Set(header.warnings)
  const rawLines = new Set(header.lines)
  const lines: string[] = [], warnings: string[] = []

  for (let index = 0; index < header.lines.length; index += 1) {
    const firstLine = header.lines[index]
    const parts = [firstLine]
    let warning = originalWarnings.has(firstLine)
    if (CLIENT_ACTIVITY_NOTE_PREFIXES.some(prefix => noteText(firstLine).startsWith(prefix))) {
      while (index + 1 < header.lines.length && !isBoundary(header.lines[index + 1])) {
        index += 1
        parts.push(header.lines[index])
        warning ||= originalWarnings.has(header.lines[index])
      }
    }
    const line = parts.join(' ')
    lines.push(line)
    if (warning) warnings.push(line)
  }
  // Carry any independently supplied warning, too; this view does not decide warning semantics.
  warnings.push(...header.warnings.filter(line => !rawLines.has(line)))
  return { lines, warnings }
}
