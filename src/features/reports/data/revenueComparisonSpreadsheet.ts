import type { SpreadsheetReportHeader, SpreadsheetSheet } from '../types'
import { REVENUE_COMPARISON_CAPTIONS, REVENUE_COMPARISON_TITLE, REVENUE_COMPARISON_MAXIMUM } from './revenueComparison'
import { isComparisonDate } from './clientPeriodComparison'

export const REVENUE_COMPARISON_EMPTY_STATE = 'Стан звіту: проведених продажів в обох вибраних періодах немає'
export const REVENUE_COMPARISON_NOTE_PREFIXES = ["Періоди виручки:", "Основа виручки:", "Правило зміни:", "Точність виручки:", "Покриття виручки:", "Договори виручки:", "Підсумки виручки:", "Джерело виручки:"] as const
const longestCaptionsFirst = REVENUE_COMPARISON_CAPTIONS.toSorted((a, b) => b.length - a.length)
const readTime = /^Час читання \(UTC\): (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3}) – (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3})$/
const text = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const invalid = () => new Error('Некоректний файл порівняння виручки: потрібні два періоди, вісім пояснень і підтверджені формати показників. Файл не застосовано.')
export const isRevenueComparisonSheet = (sheet: SpreadsheetSheet | null): boolean => sheet?.header?.lines[0] === REVENUE_COMPARISON_TITLE
export const revenueComparisonColumn = (caption: string | undefined): number => REVENUE_COMPARISON_CAPTIONS.findIndex(item => item === caption?.split(' · ').at(-1))

function orderedPeriod(line: string, prefix: string): boolean {
  const match = line.slice(prefix.length).trim().match(/^(\d{2})\.(\d{2})\.(\d{4}) – (\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return false
  const from = `${match[3]}-${match[2]}-${match[1]}`, to = `${match[6]}-${match[5]}-${match[4]}`
  return isComparisonDate(from) && isComparisonDate(to) && from <= to
}

/** The last caption contains a comma: only whole known captions delimit the selected measure list. */
function selectedCaptions(value: string): string[] | null {
  const result: string[] = [], used = new Set<string>()
  let remaining = value
  while (remaining) {
    const caption = longestCaptionsFirst.find(item => remaining === item || remaining.startsWith(`${item}, `))
    if (!caption || used.has(caption)) return null
    result.push(caption)
    used.add(caption)
    remaining = remaining.slice(caption.length).replace(/^, /, '')
  }
  return result.length ? result : null
}

export function validateRevenueComparisonHeader(title: string, header: SpreadsheetReportHeader | null): void {
  if (title !== REVENUE_COMPARISON_TITLE) return
  const lines = header?.lines.map(text)
  if (!lines || header!.columnGroupings.length || JSON.stringify(header!.rowGroupings) !== JSON.stringify(['Клієнт', 'Договір'])
    || ['Період:', 'Поточний стан:'].some(prefix => lines.some(line => line.startsWith(prefix)))) throw invalid()
  for (const prefix of ['Поточний період:', 'Період порівняння:']) {
    const matches = lines.filter(line => line.startsWith(prefix))
    if (matches.length !== 1 || !orderedPeriod(matches[0], prefix)) throw invalid()
  }
  const readLines = lines.filter(line => line.startsWith('Час читання (UTC):')), match = readLines[0]?.match(readTime)
  if (readLines.length !== 1 || !match) throw invalid()
  const start = `${match[3]}-${match[2]}-${match[1]}T${match[4]}Z`, end = `${match[7]}-${match[6]}-${match[5]}T${match[8]}Z`
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || start > end
    || new Date(start).toISOString() !== start || new Date(end).toISOString() !== end) throw invalid()
  const measureLine = lines.find(line => line.startsWith('Показники:'))
  if (!measureLine || !['Рядки:', 'Колонки:', 'Показники:', 'Фільтри:'].every(prefix => lines.filter(line => line.startsWith(prefix)).length === 1)
    || !selectedCaptions(measureLine.slice('Показники:'.length).trim())
    || !REVENUE_COMPARISON_NOTE_PREFIXES.every(prefix => {
      const matches = lines.filter(line => line.startsWith(prefix))
      return matches.length === 1 && matches[0].slice(prefix.length).trim().length > 0
    })) throw invalid()
}

/** Raw amounts are absent from the file. Never recompute deltas, ratios or rollups from published rounded values. */
export function validateRevenueComparisonSheet(sheet: SpreadsheetSheet): SpreadsheetSheet {
  if (!isRevenueComparisonSheet(sheet)) return sheet
  const width = sheet.header!.rowGroupings.length
  const columns = sheet.columns.slice(width).map(revenueComparisonColumn)
  const measureLine = sheet.header!.lines.map(text).find(line => line.startsWith('Показники:'))
  const declared = measureLine ? selectedCaptions(measureLine.slice('Показники:'.length).trim()) : null
  if (!declared || !columns.length || columns.some(index => index < 0) || new Set(columns).size !== columns.length
    || sheet.columns[0] !== 'Клієнт' || sheet.columns[1] !== 'Договір'
    || columns.length !== declared.length || columns.some((index, position) => REVENUE_COMPARISON_CAPTIONS[index] !== declared[position]
      || sheet.columns[width + position] !== `Записана виручка · ${REVENUE_COMPARISON_CAPTIONS[index]}`)) throw invalid()
  for (const row of sheet.rows) {
    if (row.cells.length > sheet.columns.length) throw invalid()
    for (const offset of columns.keys()) {
      const cell = row.cells[width + offset]
      if (cell === null || cell === '' || cell === undefined) continue
      if (typeof cell !== 'number' || !Number.isFinite(cell)) throw invalid()
      if (Math.abs(cell) > REVENUE_COMPARISON_MAXIMUM || Number(cell.toFixed(2)) !== cell) throw invalid()
    }
    validatePublishedDerivatives(columns, row.cells.slice(width))
  }
  const states = sheet.header!.lines.filter(line => line.startsWith('Стан звіту:'))
  const totals = sheet.rows.filter(row => row.kind === 'total')
  if (totals.length > 1) throw invalid()
  if (states.length && (states.length !== 1 || states[0] !== REVENUE_COMPARISON_EMPTY_STATE || sheet.rows.some(row => row.kind !== 'total')
    || totals.length !== 1 || columns.some((kind, offset) => totals[0].cells[width + offset] !== (kind === 3 ? 100 : 0)))) throw invalid()
  if (!states.length && !sheet.rows.some(row => row.kind === 'data') && totals.length) throw invalid()
  return sheet
}

function validatePublishedDerivatives(columns: number[], values: unknown[]): void {
  const current = values[columns.indexOf(0)], previous = values[columns.indexOf(1)]
  const derived = [2, 3].filter(kind => columns.includes(kind))
  const absent = (value: unknown) => value == null || value === ''
  if ((columns.includes(0) && absent(current)) || (columns.includes(1) && absent(previous))) {
    if (derived.some(kind => !absent(values[columns.indexOf(kind)]))) throw invalid()
  }
}
