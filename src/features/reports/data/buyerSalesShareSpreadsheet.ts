import type { SpreadsheetCellValue, SpreadsheetReportHeader, SpreadsheetSheet } from '../types'
import { BUYER_SALES_SHARE_CAPTIONS, BUYER_SALES_SHARE_TITLE, BUYER_SALES_SHARE_MAXIMUM } from './buyerSalesShare'
import { isComparisonDate } from './clientPeriodComparison'

export const BUYER_SALES_SHARE_EMPTY_STATE = 'Стан звіту: проведених продажів в обох вибраних періодах немає'
export const BUYER_SALES_SHARE_NOTE_PREFIXES = ["Періоди часток:", "Основа часток:", "Історія покупців:", "Правила часток:", "Точність часток:", "Покриття часток:", "Підсумки часток:", "Джерело часток:"] as const
const longestCaptionsFirst = BUYER_SALES_SHARE_CAPTIONS.toSorted((a, b) => b.length - a.length)
const readTime = /^Час читання \(UTC\): (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3}) – (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3})$/
const text = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const invalid = () => new Error('Некоректний файл часток продажів покупцям: потрібні два періоди, вісім пояснень і підтверджені формати показників. Файл не застосовано.')
export const isBuyerSalesShareSheet = (sheet: SpreadsheetSheet | null): boolean => sheet?.header?.lines[0] === BUYER_SALES_SHARE_TITLE
export const buyerSalesShareColumn = (caption: string | undefined): number => BUYER_SALES_SHARE_CAPTIONS.findIndex(item => item === caption?.split(' · ').at(-1))

/** A source17 caption or note cannot be relabelled as an ordinary additive CSV. */
export function validateBuyerSalesShareAttribution(rows: SpreadsheetCellValue[][], format: 'workbook' | 'flat'): void {
  const title = String(rows[0]?.[0] ?? '').trim()
  // Ordinary CSV only declares columns on its first row. Native files place
  // metadata before the first blank separator, then one/two column-header rows.
  // Business labels in a legacy report body must not turn it into source17.
  const metadata = rows.slice(0, 6).some(row => /^(?:Поточний період:|Рядки:|Час читання \(UTC\):)/.test(String(row[0] ?? '')))
  const separator = metadata ? rows.findIndex(row => row.every(cell => cell == null || String(cell).trim() === '')) : -1
  const axisHeader = metadata ? rows.findIndex(row => row[0] === 'Клієнт' && row[1] === 'Договір') : -1
  const headerEnd = separator >= 0 ? separator + (format === 'flat' ? 2 : 3) : axisHeader >= 0 ? axisHeader + 1 : 1
  const marked = rows.slice(0, headerEnd).some(row => row.some(cell => typeof cell === 'string' && (
    BUYER_SALES_SHARE_CAPTIONS.some(caption => cell === caption || cell === `Частка продажів покупцям · ${caption}`)
    || BUYER_SALES_SHARE_NOTE_PREFIXES.some(prefix => text(cell).startsWith(prefix)))))
  if (marked && title !== BUYER_SALES_SHARE_TITLE) throw invalid()
}

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

export function validateBuyerSalesShareHeader(title: string, header: SpreadsheetReportHeader | null): void {
  if (title !== BUYER_SALES_SHARE_TITLE) return
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
    || !BUYER_SALES_SHARE_NOTE_PREFIXES.every(prefix => {
      const matches = lines.filter(line => line.startsWith(prefix))
      return matches.length === 1 && matches[0].slice(prefix.length).trim().length > 0
    })) throw invalid()
}

/** Raw amounts are absent from the file. Never recompute deltas, ratios or rollups from published rounded values. */
export function validateBuyerSalesShareSheet(sheet: SpreadsheetSheet): SpreadsheetSheet {
  if (!isBuyerSalesShareSheet(sheet)) return sheet
  const width = sheet.header!.rowGroupings.length
  const columns = sheet.columns.slice(width).map(buyerSalesShareColumn)
  const measureLine = sheet.header!.lines.map(text).find(line => line.startsWith('Показники:'))
  const declared = measureLine ? selectedCaptions(measureLine.slice('Показники:'.length).trim()) : null
  if (!declared || !columns.length || columns.some(index => index < 0) || new Set(columns).size !== columns.length
    || sheet.columns[0] !== 'Клієнт' || sheet.columns[1] !== 'Договір'
    || columns.length !== declared.length || columns.some((index, position) => BUYER_SALES_SHARE_CAPTIONS[index] !== declared[position]
      || sheet.columns[width + position] !== `Частка продажів покупцям · ${BUYER_SALES_SHARE_CAPTIONS[index]}`)) throw invalid()
  const offsets = new Map(columns.map((kind, offset) => [kind, offset]))
  const periodOffsets = [[0, 4], [1, 5]].map(period => period.flatMap(kind => offsets.has(kind) ? [offsets.get(kind)!] : []))
  const derivativeOffsets = [2, 3, 6, 7].flatMap(kind => offsets.has(kind) ? [offsets.get(kind)!] : [])
  for (const row of sheet.rows) {
    if (row.cells.length > sheet.columns.length) throw invalid()
    for (const offset of columns.keys()) {
      const cell = row.cells[width + offset]
      if (cell === null || cell === '' || cell === undefined) continue
      if (typeof cell !== 'number' || !Number.isFinite(cell)) throw invalid()
      if (Math.abs(cell) > BUYER_SALES_SHARE_MAXIMUM || Number(cell.toFixed(2)) !== cell) throw invalid()
    }
    validatePublishedDerivatives(periodOffsets, derivativeOffsets, row.cells.slice(width))
  }
  const states = sheet.header!.lines.filter(line => line.startsWith('Стан звіту:'))
  const totals = sheet.rows.filter(row => row.kind === 'total')
  if (totals.length > 1) throw invalid()
  if (states.length && (states.length !== 1 || states[0] !== BUYER_SALES_SHARE_EMPTY_STATE || sheet.rows.some(row => row.kind !== 'total')
    || totals.length !== 1 || columns.some((kind, offset) => totals[0].cells[width + offset] !== (kind === 3 || kind === 7 ? 100 : 0)))) throw invalid()
  if (!states.length && !sheet.rows.some(row => row.kind === 'data') && totals.length) throw invalid()
  return sheet
}

function validatePublishedDerivatives(periodOffsets: number[][], derivativeOffsets: number[], values: unknown[]): void {
  const absent = (offset: number) => values[offset] == null || values[offset] === ''
  // Both classes share a period's known status. Offsets are prepared once per
  // file; no ratios, complements or deltas are recalculated for any row.
  for (const selected of periodOffsets) {
    if (selected.some(absent) && (selected.some(offset => !absent(offset)) || derivativeOffsets.some(offset => !absent(offset)))) throw invalid()
  }
}
