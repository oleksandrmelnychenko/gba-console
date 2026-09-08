import type { SpreadsheetReportHeader, SpreadsheetSheet } from '../types'
import { isComparisonDate } from './clientPeriodComparison'
import { IMPORTED_PAYMENTS_CAPTIONS, IMPORTED_PAYMENTS_TITLE } from './importedPayments'

export const IMPORTED_PAYMENTS_EMPTY_STATE = 'Стан звіту: імпортованих платежів у вибраному обсязі немає'
export const IMPORTED_PAYMENTS_NOTE_PREFIXES = ['Джерело записаних платежів:', 'Дата записаних платежів:',
  'Покриття записаних платежів:', 'Валюта записаних платежів:', 'Договори записаних платежів:', 'Межі порівняння платежів з 1С:'] as const
const groupingCaptions = new Set(['По роках', 'По кварталах', 'По місяцях', 'Дата', 'Клієнт', 'Договір', 'Організація документа', 'Рахунок', 'Валюта рахунку', 'Тип рахунку',
  'Запис імпортованого платежу', 'Напрям платежу', 'Стаття записаного платежу', 'Система імпорту платежу'])
const captions = new Set<string>(IMPORTED_PAYMENTS_CAPTIONS)
const periodPattern = /^Період: (\d{2})\.(\d{2})\.(\d{4}) – (\d{2})\.(\d{2})\.(\d{4})$/
const readPattern = /^Час читання \(UTC\): (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3}) – (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3})$/
const text = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const invalid = () => new Error('Некоректний файл записаних імпортованих платежів: потрібні період, час читання, повні пояснення та суми з точністю до чотирьох десяткових знаків. Файл не застосовано.')
export const isImportedPaymentsSheet = (sheet: SpreadsheetSheet | null): boolean => sheet?.header?.lines[0] === IMPORTED_PAYMENTS_TITLE
export const isImportedPaymentCaption = (caption: string | undefined): boolean => captions.has(caption?.split(' · ').at(-1) ?? '')

function declaredMeasures(header: SpreadsheetReportHeader): string[] | null {
  const lines = header.lines.flatMap(raw => { const line = text(raw); return line.startsWith('Показники:') ? [line] : [] })
  if (lines.length !== 1) return null
  const selected = lines[0].slice('Показники:'.length).trim().split(', ')
  return selected.length && selected.every(caption => captions.has(caption)) && new Set(selected).size === selected.length ? selected : null
}

export function validateImportedPaymentsHeader(title: string, header: SpreadsheetReportHeader | null): void {
  if (title !== IMPORTED_PAYMENTS_TITLE) return
  if (!header) throw invalid()
  const lines = header.lines.map(text), periodLines = lines.filter(line => line.startsWith('Період:'))
  const period = periodLines[0]?.match(periodPattern)
  if (periodLines.length !== 1 || !period || !declaredMeasures(header)
    || lines.some(line => line.startsWith('Поточний стан:') || line.startsWith('Період порівняння:'))) throw invalid()
  const from = `${period[3]}-${period[2]}-${period[1]}`, to = `${period[6]}-${period[5]}-${period[4]}`
  if (!isComparisonDate(from) || !isComparisonDate(to) || from > to) throw invalid()
  const readLines = lines.filter(line => line.startsWith('Час читання (UTC):')), read = readLines[0]?.match(readPattern)
  if (readLines.length !== 1 || !read) throw invalid()
  const start = `${read[3]}-${read[2]}-${read[1]}T${read[4]}Z`, end = `${read[7]}-${read[6]}-${read[5]}T${read[8]}Z`
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || start > end
    || new Date(start).toISOString() !== start || new Date(end).toISOString() !== end) throw invalid()
  if (!header.rowGroupings.length || ![header.rowGroupings, header.columnGroupings].every(axis => axis.length <= 14 && new Set(axis).size === axis.length && axis.every(caption => groupingCaptions.has(caption)))
    || !['Рядки:', 'Колонки:'].every(prefix => lines.filter(line => line.startsWith(prefix)).length === 1)
    || !IMPORTED_PAYMENTS_NOTE_PREFIXES.every(prefix => {
      const matches = lines.filter(line => line.startsWith(prefix))
      return matches.length === 1 && matches[0].slice(prefix.length).trim().length > 0
    })) throw invalid()
}

/** A workbook lacks the private currency basis. Keep server money and blanks; never infer local monetary coverage. */
export function validateImportedPaymentsSheet(sheet: SpreadsheetSheet): SpreadsheetSheet {
  if (!isImportedPaymentsSheet(sheet) || !sheet.header) return sheet
  const width = sheet.header.rowGroupings.length, selected = declaredMeasures(sheet.header)
  const resources = sheet.columns.slice(width).map(column => column.split(' · ').at(-1))
  if (!selected || !resources.length || resources.length % selected.length
    || resources.some((caption, index) => caption !== selected[index % selected.length])) throw invalid()
  for (const row of sheet.rows) {
    if (row.cells.length > sheet.columns.length) throw invalid()
    for (const cell of row.cells.slice(width)) {
      if (cell == null || cell === '') continue
      if (typeof cell !== 'number' || !Number.isFinite(cell) || Number(cell.toFixed(4)) !== cell) throw invalid()
    }
  }
  const states = sheet.header.lines.filter(line => line.startsWith('Стан звіту:'))
  if (states.length && (states.length !== 1 || states[0] !== IMPORTED_PAYMENTS_EMPTY_STATE || sheet.rows.length)) throw invalid()
  if (sheet.rows.filter(row => row.kind === 'total').length > 1) throw invalid()
  return sheet
}
