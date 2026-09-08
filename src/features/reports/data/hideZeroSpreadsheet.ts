import type { SpreadsheetCellValue, SpreadsheetReportHeader, SpreadsheetSheet } from '../types'
import { ACCOUNT_BALANCE_AMOUNT_CAPTION, ACCOUNT_BALANCE_REPORT_TITLE } from './nativeReportProfiles'
import { HIDE_ZERO_ALL_HIDDEN_STATE, HIDE_ZERO_NOTE_PREFIXES } from './reportHideZero'

const statePrefix = 'Стан звіту:'
const filled = (value: SpreadsheetCellValue) => value !== null && value !== undefined && String(value).trim() !== ''
const noteText = (value: string) => value.trim().replace(/^!\s*/, '')
type HeaderRead = { header: SpreadsheetReportHeader; tableTopIndex: number }

/** An explicit server-authored file state, never inferred from displayed numeric values. */
export function readHideZeroSheet(name: string, rows: SpreadsheetCellValue[][], metadata: HeaderRead | null,
  knownNativeTitle: boolean): SpreadsheetSheet | null {
  const markers = rows.filter(row => row.some(cell => typeof cell === 'string' && cell.trim().startsWith(statePrefix)))
  if (!knownNativeTitle || markers.length === 0) return null
  const hasExactMarker = markers.some(row => row.some(cell => typeof cell === 'string' && cell.trim() === HIDE_ZERO_ALL_HIDDEN_STATE))
  const possibleBody = metadata ? rows.slice(metadata.tableTopIndex).filter(row => row.some(filled)) : []
  // A business caption may start with the same generic words inside an ordinary table.
  // Only the exact reserved marker, or a standalone state replacing the whole body, claims this presentation.
  if (!hasExactMarker && !(possibleBody.length === 1 && String(possibleBody[0][0] ?? '').trim().startsWith(statePrefix))) return null
  const malformed = () => { throw new Error('Некоректний стан звіту: маркер прихованих нулів потребує повних метаданих залишків рахунків і не може містити таблицю або інший маркер.') }
  if (!metadata || markers.length !== 1 || metadata.header.lines[0] !== ACCOUNT_BALANCE_REPORT_TITLE) return malformed()
  const { header, tableTopIndex } = metadata
  const body = rows.slice(tableTopIndex).filter(row => row.some(filled))
  if (body.length !== 1 || String(body[0][0] ?? '').trim() !== HIDE_ZERO_ALL_HIDDEN_STATE
    || body[0].slice(1).some(filled)
    || header.lines.some(line => line.startsWith(statePrefix) || line === 'За вибраними умовами даних не знайдено')) return malformed()
  const nativeRows = header.rowGroupings.filter(caption => caption !== 'ABC-клас')
  if (nativeRows.length !== 1 || nativeRows[0] !== 'Запис залишку рахунку'
    || header.rowGroupings.length > 2 || header.columnGroupings.length !== 0
    || !header.lines.includes(`Показники: ${ACCOUNT_BALANCE_AMOUNT_CAPTION}`)) return malformed()
  const notes = header.lines.map(noteText)
  if (!HIDE_ZERO_NOTE_PREFIXES.every(prefix => notes.filter(line => line.startsWith(prefix)).length === 1)
    || !['Рядки:', 'Колонки:', 'Показники:', 'Фільтри:'].every(prefix => header.lines.filter(line => line.startsWith(prefix)).length === 1)) return malformed()
  return { name, columns: [], rows: [], presentationState: 'all_confirmed_zero_hidden',
    header: { ...header, lines: [...header.lines, HIDE_ZERO_ALL_HIDDEN_STATE] } }
}

export function hiddenZeroExportRows(sheet: SpreadsheetSheet, rows: SpreadsheetCellValue[][],
  totalsRow?: SpreadsheetCellValue[] | null): SpreadsheetCellValue[][] {
  if (!sheet.header || sheet.columns.length || sheet.rows.length || rows.length || totalsRow
    || sheet.header.lines.filter(line => line === HIDE_ZERO_ALL_HIDDEN_STATE).length !== 1)
    throw new Error('Стан прихованих нулів суперечить рядкам або показникам файлу. Експорт зупинено.')
  return [...sheet.header.lines.flatMap(line => line === HIDE_ZERO_ALL_HIDDEN_STATE ? [] : [[line]]), [], [HIDE_ZERO_ALL_HIDDEN_STATE]]
}
