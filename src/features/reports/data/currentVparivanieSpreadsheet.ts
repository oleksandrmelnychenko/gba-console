import type { SpreadsheetReportHeader, SpreadsheetSheet } from '../types'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, CURRENT_VPARIVANIE_TITLE, CURRENT_VPARIVANIE_FULL_TITLE, CURRENT_VPARIVANIE_FULL_NOTE } from './currentVparivanie'

export const CURRENT_VPARIVANIE_DISPLAY_LINE = `Колонки товару: ${CURRENT_VPARIVANIE_PRODUCT_CAPTIONS.join(', ')}`
const invalid = () => new Error('Некоректний файл поточної матриці «Впарювання»: потрібні сім атрибутів товару, один «Результат», поточний залишок і явний період продажів.')
export const isCurrentVparivanieSheet = (sheet: SpreadsheetSheet | null): boolean => !!sheet?.header && [CURRENT_VPARIVANIE_TITLE, CURRENT_VPARIVANIE_FULL_TITLE].includes(sheet.header.lines[0])

/** The workbook declares display width independently of the one Product identity. */
export function currentVparivanieDisplayHeader(title: string, header: SpreadsheetReportHeader | null): SpreadsheetReportHeader | null {
  if (![CURRENT_VPARIVANIE_TITLE, CURRENT_VPARIVANIE_FULL_TITLE].includes(title)) return header
  if (title === CURRENT_VPARIVANIE_FULL_TITLE && !header?.lines.includes(`! ${CURRENT_VPARIVANIE_FULL_NOTE}`)) throw invalid()
  if (!header || header.rowGroupings.join(',') !== 'Товар' || header.columnGroupings.length !== 2
    || header.lines.filter(line => line.startsWith('Колонки товару:')).length !== 1
    || !header.lines.includes(CURRENT_VPARIVANIE_DISPLAY_LINE)
    || header.lines.filter(line => line.startsWith('Показники:')).join(',') !== 'Показники: Результат'
    || header.lines.filter(line => /^Період: \d{2}\.\d{2}\.\d{4} – \d{2}\.\d{2}\.\d{4}$/.test(line)).length !== 1) throw invalid()
  // Attribution lines retain the semantic axis. Only table parsing uses seven display columns.
  return { ...header, rowGroupings: [...CURRENT_VPARIVANIE_PRODUCT_CAPTIONS] }
}

export function validateCurrentVparivanieSheet(sheet: SpreadsheetSheet): SpreadsheetSheet {
  if (!isCurrentVparivanieSheet(sheet)) return sheet
  if (sheet.columns.length < 8 || sheet.columns.length > 263 || sheet.rows.length > (sheet.header?.lines[0] === CURRENT_VPARIVANIE_FULL_TITLE ? 500000 : 128)
    || sheet.rows.length * sheet.columns.length > 1000000
    || sheet.columns.slice(0, 7).join(',') !== CURRENT_VPARIVANIE_PRODUCT_CAPTIONS.join(',')
    || sheet.columns.slice(7).some(column => column.split(' · ').at(-1) !== 'Результат')) throw invalid()
  for (const row of sheet.rows) {
    if (row.kind !== 'data' || row.cells.length > sheet.columns.length
      || row.cells[0] === 'Загальний підсумок' || String(row.cells[0] ?? '').startsWith('Підсумок:')
      || row.cells.slice(0, 7).some(value => value !== null && value !== '' && typeof value !== 'string')
      || row.cells.slice(7).some(value => value !== null && value !== '' && (typeof value !== 'number' || !Number.isFinite(value)))) throw invalid()
    // Missing trailing styled NULL cells are explicit blanks, never the preceding product's value.
    row.cells = Array.from({ length: sheet.columns.length }, (_, index) => index >= 7 && row.cells[index] === '' ? null : row.cells[index] ?? null)
  }
  return sheet
}
