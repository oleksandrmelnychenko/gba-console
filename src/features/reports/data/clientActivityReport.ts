import type { SpreadsheetReportHeader, SpreadsheetSheet } from '../types'

export const CLIENT_ACTIVITY_REPORT_TITLE = 'Клієнти в проведених продажах GBA'
export const CLIENT_ACTIVITY_EMPTY_STATE = 'Стан звіту: проведених продажів у вибраному обсязі немає'
export const CLIENT_ACTIVITY_COUNT_CAPTION = 'Унікальні клієнти (поточні прив’язки GBA)'
export const CLIENT_ACTIVITY_NOTE_PREFIXES = ['Джерело активності клієнтів:', 'Ідентичність клієнтів:',
  'Покриття активності клієнтів:', 'Підсумки клієнтів:', 'Межі порівняння з 1С:'] as const
const periodLine = /^Період: \d{2}\.\d{2}\.\d{4} – \d{2}\.\d{2}\.\d{4}$/
const readTimeLine = /^Час читання \(UTC\): \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}\.\d{3} – \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}\.\d{3}$/
const metadataText = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const malformed = () => new Error('Некоректний файл активності клієнтів: потрібні повні метадані періоду й розрахунку та цілі невід’ємні значення. Файл не застосовано.')

export function isClientActivitySheet(sheet: SpreadsheetSheet | null): boolean {
  return sheet?.header?.lines[0] === CLIENT_ACTIVITY_REPORT_TITLE
}

/** An uploaded report preserves its stated context; its labels do not certify source parity. */
export function validateClientActivityHeader(title: string, header: SpreadsheetReportHeader | null): void {
  if (title !== CLIENT_ACTIVITY_REPORT_TITLE) return
  const lines = header?.lines.map(metadataText)
  if (!lines || lines.filter(line => line.startsWith('Період:')).length !== 1 || !lines.some(line => periodLine.test(line))
    || lines.filter(line => line.startsWith('Час читання (UTC):')).length !== 1 || !lines.some(line => readTimeLine.test(line))
    || lines.some(line => line.startsWith('Поточний стан:'))
    || lines.filter(line => line.startsWith('Показники:')).length !== 1
    || !lines.includes(`Показники: ${CLIENT_ACTIVITY_COUNT_CAPTION}`)
    || !['Рядки:', 'Колонки:'].every(prefix => lines.filter(line => line.startsWith(prefix)).length === 1)
    || !CLIENT_ACTIVITY_NOTE_PREFIXES.every(prefix => {
      const matches = lines.filter(line => line.startsWith(prefix))
      return matches.length === 1 && matches[0].slice(prefix.length).trim().length > 0
    })) throw malformed()
}

/** No set basis is present in the file: preserve server values and never infer a union from printed counts. */
export function validateClientActivitySheet(sheet: SpreadsheetSheet): SpreadsheetSheet {
  if (!isClientActivitySheet(sheet)) return sheet
  const width = sheet.header!.rowGroupings.length
  if (sheet.columns.length <= width || sheet.columns.slice(width).some(column => column.split(' · ').at(-1) !== CLIENT_ACTIVITY_COUNT_CAPTION)) throw malformed()
  const states = sheet.header!.lines.filter(line => line.startsWith('Стан звіту:'))
  const totals = sheet.rows.filter(row => row.kind === 'total')
  if (states.length && (states.length !== 1 || states[0] !== CLIENT_ACTIVITY_EMPTY_STATE
    || sheet.rows.some(row => row.kind !== 'total') || totals.length !== 1
    || sheet.columns.length !== width + 1 || totals[0].cells[width] !== 0)) throw malformed()
  if (!states.length && !sheet.rows.some(row => row.kind === 'data') && totals.some(row => row.cells.slice(width).includes(0))) throw malformed()
  for (const row of sheet.rows) {
    if (row.cells.length > sheet.columns.length) throw malformed()
    for (const cell of row.cells.slice(width)) {
      if (cell === null || cell === '') continue
      if (typeof cell !== 'number' || !Number.isSafeInteger(cell) || cell < 0 || cell > 200000) throw malformed()
    }
  }
  return sheet
}
