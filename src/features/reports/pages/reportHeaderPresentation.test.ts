import { describe, expect, it } from 'vitest'
import { clientActivityWorkbookRows } from '../data/clientActivity.test-fixtures'
import { CLIENT_ACTIVITY_EMPTY_STATE, CLIENT_ACTIVITY_NOTE_PREFIXES, CLIENT_ACTIVITY_REPORT_TITLE } from '../data/clientActivityReport'
import { buildSheetExportRows, buildSpreadsheetSheet } from '../spreadsheet'
import type { SpreadsheetReportHeader } from '../types'
import { buildSpreadsheetCsv } from '../utils'
import { getReportHeaderPresentation } from './reportHeaderPresentation'
import { wrappedClientActivityHeaderLines } from './reportHeaderPresentation.test-fixtures'

const makeHeader = (lines: string[], warnings: string[] = []): SpreadsheetReportHeader => ({
  lines, warnings, rowGroupings: ['По місяцях'], columnGroupings: [],
})

it('assembles the actual wrapped writer notes without changing raw metadata, warning classification, CSV or counts', () => {
  const body = clientActivityWorkbookRows('known')
  const separator = body.findIndex(row => row.length === 0)
  const sheet = buildSpreadsheetSheet('Report', [
    ...wrappedClientActivityHeaderLines.map(line => [line]), ...body.slice(separator),
  ])
  const before = structuredClone(sheet)
  const csvBefore = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  Object.freeze(sheet.header!.lines)
  Object.freeze(sheet.header!.warnings)
  Object.freeze(sheet.header!)

  const presentation = getReportHeaderPresentation(sheet.header!)
  expect(presentation.lines).toHaveLength(wrappedClientActivityHeaderLines.length - 3)
  for (const prefix of CLIENT_ACTIVITY_NOTE_PREFIXES) {
    expect(presentation.lines.filter(line => line.startsWith(`! ${prefix}`))).toHaveLength(1)
  }
  expect(presentation.warnings).toHaveLength(4)
  expect(presentation.warnings.some(line => line.startsWith('! Джерело активності клієнтів:'))).toBe(false)
  expect(presentation.warnings.find(line => line.startsWith('! Покриття активності клієнтів:')))
    .toContain('товар без метаданих — 0; нульова кількість — 454; від’ємна кількість — 0.')
  expect(presentation.warnings.find(line => line.startsWith('! Підсумки клієнтів:')))
    .toContain('не впливають на присутність клієнта.')
  expect(presentation.warnings.find(line => line.startsWith('! Межі порівняння з 1С:')))
    .toContain('Порівняння поточного та попереднього періодів не виконується.')
  expect(presentation.lines.join(' ')).toBe(wrappedClientActivityHeaderLines.join(' '))
  expect(sheet).toEqual(before)
  expect(buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))).toBe(csvBefore)
})

describe('logical note boundaries', () => {
  it.each([
    '! Сортування: за назвою', '!Нова примітка: збережена',
    'Період: 01.06.2026 – 31.07.2026', 'Час читання (UTC): час',
    'Поточний стан: стан', 'Параметри запиту: параметри',
    'Рядки: По місяцях', 'Колонки: —', 'Показники: Клієнти',
    'Фільтри: застосовано: 1', 'Сортування: за назвою',
    CLIENT_ACTIVITY_EMPTY_STATE, 'Собівартість: немає даних', 'ПДВ: немає даних', 'Докладні примітки: див. окремий аркуш',
    'УВАГА, фільтри не застосовано: 1', '    • Договір = 455430', '- Договір = 455430', '',
    ...CLIENT_ACTIVITY_NOTE_PREFIXES.map(prefix => `${prefix} наступна примітка`),
  ])('does not consume a following metadata, filter, state or note line: %s', boundary => {
    const start = '! Покриття активності клієнтів: початок'
    const header = makeHeader([CLIENT_ACTIVITY_REPORT_TITLE, start, 'продовження.', boundary], [start])
    expect(getReportHeaderPresentation(header)).toEqual({
      lines: [CLIENT_ACTIVITY_REPORT_TITLE, `${start} продовження.`, boundary],
      warnings: [`${start} продовження.`],
    })
  })
})

it('retains warnings from continuations and separate warnings without joining unrelated metadata', () => {
  const start = '! Джерело активності клієнтів: початок'
  const continuation = 'немає даних про джерело.'
  const separate = 'УВАГА: інша перевірка'
  const header = makeHeader([CLIENT_ACTIVITY_REPORT_TITLE, start, continuation,
    '! Сортування: початок', 'окремий фізичний рядок'], [continuation, separate])
  expect(getReportHeaderPresentation(header)).toEqual({
    lines: [CLIENT_ACTIVITY_REPORT_TITLE, `${start} ${continuation}`,
      '! Сортування: початок', 'окремий фізичний рядок'],
    warnings: [`${start} ${continuation}`, separate],
  })
})

it.each(['Звіт продажів', `${CLIENT_ACTIVITY_REPORT_TITLE} — копія`, ''])('preserves every older or unrecognized source header by reference: %s', title => {
  const lines = [...wrappedClientActivityHeaderLines]
  lines[0] = title
  const header = makeHeader(lines, [lines[9]])
  expect(getReportHeaderPresentation(header)).toBe(header)
})
