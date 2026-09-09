import type { SpreadsheetCellValue, SpreadsheetReportHeader, SpreadsheetSheet } from '../types'
import { RATE_COMPARISON_CAPTIONS, RATE_COMPARISON_GROUP, RATE_COMPARISON_RESOURCE, RATE_COMPARISON_TITLE, rateDefinitionId } from './rateComparison'
import { isComparisonDate } from './clientPeriodComparison'

export const RATE_COMPARISON_NOTE_PREFIXES = ['Джерело звіту:', 'Валютна пара:', 'Поточний запис:', 'Запис порівняння:', 'Календар курсів:', 'Обчислення курсів:', 'Невідомі курси:', 'Межі відповідності:'] as const
const text = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const invalid = () => new Error('Некоректний файл історичних курсів: потрібні одна точна валютна пара, дві дати й підтверджені показники без підсумків. Файл не застосовано.')
export const isRateComparisonSheet = (sheet: SpreadsheetSheet | null): boolean => sheet?.header?.lines[0] === RATE_COMPARISON_TITLE
export const rateComparisonColumn = (caption: string | undefined): number => RATE_COMPARISON_CAPTIONS.findIndex(item => item === caption?.split(' · ').at(-1))
const measureCaptions = RATE_COMPARISON_CAPTIONS.toSorted((a, b) => b.length - a.length)
export function readRateSeriesIdentity(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(Комерційний|Державний): (.{1,32}) \[CurrencyID=([1-9]\d*)\] → (.{1,32}) \[CurrencyID=([1-9]\d*)\] \[RateDefinitionID=([1-9]\d*)\]$/u.exec(value)
  return match && [match[3], match[5], match[6]].every(rateDefinitionId) && match[3] !== match[5] && match[2] !== match[4]
    && [match[2], match[4]].every(code => code.trim() === code && !/\p{Cc}/u.test(code)) ? JSON.stringify([match[1], match[3], match[5], match[6]]) : null
}
function selectedCaptions(value: string): string[] | null {
  const result: string[] = [], seen = new Set<string>()
  while (value) {
    const caption = measureCaptions.find(item => value === item || value.startsWith(`${item}, `))
    if (!caption || seen.has(caption)) return null
    result.push(caption); seen.add(caption); value = value.slice(caption.length).replace(/^, /, '')
  }
  return result.length ? result : null
}
export function validateRateComparisonAttribution(rows: SpreadsheetCellValue[][], format: 'workbook' | 'flat'): void {
  const title = String(rows[0]?.[0] ?? '').trim()
  const metadata = rows.slice(0, 6).some(row => /^(?:Поточна дата:|Дата порівняння:|Рядки:|Час читання \(UTC\):)/u.test(String(row[0] ?? '')))
  const separator = metadata ? rows.findIndex(row => row.every(cell => cell == null || String(cell).trim() === '')) : -1
  const end = separator >= 0 ? separator + (format === 'flat' ? 2 : 3) : 1
  const prefixes = ['Календар курсів:', 'Обчислення курсів:', 'Невідомі курси:']
  const marked = rows.slice(0, end).some(row => row.some(cell => typeof cell === 'string' && (RATE_COMPARISON_CAPTIONS.some(caption => cell === caption || cell === `${RATE_COMPARISON_RESOURCE} · ${caption}`) || prefixes.some(prefix => text(cell).startsWith(prefix)))))
  if (marked && title !== RATE_COMPARISON_TITLE) throw invalid()
}
function readDate(line: string): string | null {
  const match = /^[^:]+: (\d{2})\.(\d{2})\.(\d{4})$/.exec(line)
  const date = match ? `${match[3]}-${match[2]}-${match[1]}` : ''
  return isComparisonDate(date) ? date : null
}
function one(lines: string[], prefix: string): string {
  const matches = lines.filter(line => line.startsWith(prefix))
  if (matches.length !== 1 || !matches[0].slice(prefix.length).trim()) throw invalid()
  return matches[0].slice(prefix.length).trim()
}
function readPoint(value: string, asOf: string): boolean {
  if (value === 'відсутній') return false
  const match = /^HistoryID=([1-9]\d*); дата=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}); курс=(\d{1,16}(?:\.\d{1,14})?)$/.exec(value)
  if (!match || !rateDefinitionId(match[1]) || match[2].slice(0, 10) > asOf) throw invalid()
  const timestamp = `${match[2].slice(0, 23)}Z`
  if (!Number.isFinite(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp) throw invalid()
  return true
}
export function validateRateComparisonHeader(title: string, header: SpreadsheetReportHeader | null): void {
  if (title !== RATE_COMPARISON_TITLE) return
  if (!header || JSON.stringify(header.rowGroupings) !== JSON.stringify([RATE_COMPARISON_GROUP]) || header.columnGroupings.length) throw invalid()
  const lines = header.lines.map(text)
  if (['Період:', 'Поточний період:', 'Поточний стан:', 'Період порівняння:', 'Стан звіту:'].some(prefix => lines.some(line => line.startsWith(prefix)))) throw invalid()
  const current = readDate(`Поточна дата: ${one(lines, 'Поточна дата:')}`), previous = readDate(`Дата порівняння: ${one(lines, 'Дата порівняння:')}`)
  if (!current || !previous) throw invalid()
  for (const prefix of [...RATE_COMPARISON_NOTE_PREFIXES, 'Рядки:', 'Колонки:', 'Фільтри:']) one(lines, prefix)
  if (!selectedCaptions(one(lines, 'Показники:')) || one(lines, 'Фільтри:') !== 'не застосовано' || one(lines, 'Джерело звіту:') !== `GBA, набір 19; збережена історія курсів. Поточна дата: ${current}; дата порівняння: ${previous}.` || !readRateSeriesIdentity(one(lines, 'Валютна пара:'))) throw invalid()
  readPoint(one(lines, 'Поточний запис:'), current); readPoint(one(lines, 'Запис порівняння:'), previous)
  const read = one(lines, 'Час читання (UTC):').match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3}) – (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3})$/)
  if (!read) throw invalid()
  const start = `${read[3]}-${read[2]}-${read[1]}T${read[4]}Z`, end = `${read[7]}-${read[6]}-${read[5]}T${read[8]}Z`
  if (![start, end].every(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value) || start > end) throw invalid()
}
/** Published cells are display values; never calculate changes, sums or averages from them. */
export function validateRateComparisonSheet(sheet: SpreadsheetSheet, format: 'workbook' | 'flat'): SpreadsheetSheet {
  if (!isRateComparisonSheet(sheet)) return sheet
  const lines = sheet.header!.lines.map(text), declared = selectedCaptions(one(lines, 'Показники:'))!
  const columns = sheet.columns.slice(1).map(rateComparisonColumn)
  if (sheet.columns[0] !== RATE_COMPARISON_GROUP || !columns.length || columns.length !== declared.length || columns.some((kind, offset) => kind < 0
    || sheet.columns[offset + 1] !== `${RATE_COMPARISON_RESOURCE} · ${declared[offset]}`) || new Set(columns).size !== columns.length) throw invalid()
  if (sheet.rows.length > 1 || (format === 'workbook' && sheet.rows.length !== 1) || sheet.rows.some(row => row.kind !== 'data')) throw invalid()
  const known = [one(lines, 'Поточний запис:') !== 'відсутній', one(lines, 'Запис порівняння:') !== 'відсутній']
  for (const row of sheet.rows) {
    if (row.cells.length > sheet.columns.length || row.cells[0] !== one(lines, 'Валютна пара:') || !readRateSeriesIdentity(row.cells[0])) throw invalid()
    columns.forEach((kind, offset) => {
      const cell = row.cells[offset + 1], absent = cell == null || cell === '', expectedKnown = kind < 2 ? known[kind] : known.every(Boolean)
      if (absent !== !expectedKnown) throw invalid()
      if (absent) return
      const decimals = kind === 3 ? 2 : 4, max = kind === 3 ? 9999999999999.99 : 99999999999.9999
      if (typeof cell !== 'number' || !Number.isFinite(cell) || Math.abs(cell) > max || Number(cell.toFixed(decimals)) !== cell || (kind < 2 && cell < 0)) throw invalid()
    })
  }
  return sheet
}
