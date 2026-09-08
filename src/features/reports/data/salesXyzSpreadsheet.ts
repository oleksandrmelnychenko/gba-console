import type { SpreadsheetReportHeader, SpreadsheetSheet } from '../types'
import { isComparisonDate } from './clientPeriodComparison'
import { XYZ_CAPTIONS, XYZ_MAXIMUM, XYZ_TITLE } from './salesXyz'

export const XYZ_EMPTY_STATE = 'Стан звіту: проведених продажів у вибраному періоді немає'
export const XYZ_NOTE_PREFIXES = ['Політика календаря:', 'Періоди XYZ:', 'Основа XYZ:', 'Межі XYZ:', 'Точність XYZ:',
  'Підсумки XYZ:', 'Межі подій UTC:', 'Покриття XYZ:', 'Джерело XYZ:'] as const
const classes = new Set(['X', 'Y', 'Z', 'Без класу', 'Невідомо'])
const periodPattern = /^Період: (\d{2})\.(\d{2})\.(\d{4}) – (\d{2})\.(\d{2})\.(\d{4})$/
const readPattern = /^Час читання \(UTC\): (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3}) – (\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3})$/
const text = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const invalid = () => new Error('Некоректний файл XYZ: потрібні період, час читання, дев’ять пояснень, класи та підтверджені формати показників. Файл не застосовано.')
export const isSalesXyzSheet = (sheet: SpreadsheetSheet | null): boolean => sheet?.header?.lines[0] === XYZ_TITLE
export const salesXyzColumn = (caption: string | undefined): number => XYZ_CAPTIONS.findIndex(item => item === caption?.split(' · ').at(-1))

/** Each caption contains a comma. Delimit complete known captions, preserving selection order. */
function declaredMeasures(header: SpreadsheetReportHeader): string[] | null {
  const lines = header.lines.flatMap(raw => { const line = text(raw); return line.startsWith('Показники:') ? [line] : [] })
  if (lines.length !== 1) return null
  let remaining = lines[0].slice('Показники:'.length).trim()
  const selected: string[] = [], used = new Set<string>()
  while (remaining) {
    const caption = XYZ_CAPTIONS.find(item => remaining === item || remaining.startsWith(`${item}, `))
    if (!caption || used.has(caption)) return null
    selected.push(caption)
    used.add(caption)
    remaining = remaining.slice(caption.length).replace(/^, /, '')
  }
  return selected.length ? selected : null
}
export function validateSalesXyzHeader(title: string, header: SpreadsheetReportHeader | null): void {
  if (title !== XYZ_TITLE) return
  if (!header) throw invalid()
  const lines = header.lines.map(text), periods = lines.filter(line => line.startsWith('Період:')), period = periods[0]?.match(periodPattern)
  if (periods.length !== 1 || !period || !declaredMeasures(header) || header.columnGroupings.length
    || JSON.stringify(header.rowGroupings) !== JSON.stringify(['Клас XYZ', 'Товар'])
    || lines.some(line => line.startsWith('Поточний стан:') || line.startsWith('Період порівняння:'))) throw invalid()
  const from = `${period[3]}-${period[2]}-${period[1]}`, to = `${period[6]}-${period[5]}-${period[4]}`
  if (!isComparisonDate(from) || !isComparisonDate(to) || from > to) throw invalid()
  const reads = lines.filter(line => line.startsWith('Час читання (UTC):')), read = reads[0]?.match(readPattern)
  if (reads.length !== 1 || !read) throw invalid()
  const start = `${read[3]}-${read[2]}-${read[1]}T${read[4]}Z`, end = `${read[7]}-${read[6]}-${read[5]}T${read[8]}Z`
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || start > end
    || new Date(start).toISOString() !== start || new Date(end).toISOString() !== end) throw invalid()
  if (!['Рядки:', 'Колонки:', 'Фільтри:'].every(prefix => lines.filter(line => line.startsWith(prefix)).length === 1)
    || !XYZ_NOTE_PREFIXES.every(prefix => {
      const matches = lines.filter(line => line.startsWith(prefix))
      return matches.length === 1 && matches[0].slice(prefix.length).trim().length > 0
    })) throw invalid()
}
/** Published values cannot reconstruct raw month sums, class boundaries or aggregate coverage. */
export function validateSalesXyzSheet(sheet: SpreadsheetSheet): SpreadsheetSheet {
  if (!isSalesXyzSheet(sheet) || !sheet.header) return sheet
  const selected = declaredMeasures(sheet.header), columns = sheet.columns.slice(2).map(salesXyzColumn)
  if (!selected || columns.length !== selected.length || sheet.columns[0] !== 'Клас XYZ' || sheet.columns[1] !== 'Товар'
    || columns.some((kind, index) => kind < 0 || selected[index] !== XYZ_CAPTIONS[kind]
      || sheet.columns[index + 2] !== `Стабільність продажів · ${XYZ_CAPTIONS[kind]}`)) throw invalid()
  for (const row of sheet.rows) {
    if (row.cells.length > sheet.columns.length || (row.kind === 'data' && !classes.has(String(row.cells[0])))) throw invalid()
    for (const [offset, kind] of columns.entries()) {
      const cell = row.cells[offset + 2]
      if (cell == null || cell === '') continue
      if (typeof cell !== 'number' || !Number.isFinite(cell) || Math.abs(cell) > XYZ_MAXIMUM || Number(cell.toFixed(2)) !== cell
        || (kind === 2 && cell < 0) || (kind > 0 && (row.kind !== 'data' || row.cells[0] === 'Невідомо'))) throw invalid()
    }
  }
  const states = sheet.header.lines.filter(line => line.startsWith('Стан звіту:'))
  if (states.length && (states.length !== 1 || states[0] !== XYZ_EMPTY_STATE || sheet.rows.length)) throw invalid()
  if (sheet.rows.filter(row => row.kind === 'total').length > 1) throw invalid()
  return sheet
}
