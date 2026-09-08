import { describe, expect, it } from 'vitest'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, filterSheetRows, getAdditiveColumns, isCurrentReportSheet, parseDelimitedText } from './spreadsheet'
import { buildSpreadsheetCsv } from './utils'
import { hideZeroAllHiddenLines, hideZeroAllHiddenRows } from './data/reportHideZero.test-fixtures'
import { HIDE_ZERO_ALL_HIDDEN_STATE } from './data/reportHideZero'
import { buildSpreadsheetChartData, getChartMeasureOptions } from './data/spreadsheetChartData'
import type { SpreadsheetCellValue } from './types'

describe('explicit metadata-only HideZero file state', () => {
  it('retains source/current metadata with zero visual rows/resources across native XLSX-style and CSV, with no invented totals', () => {
    const sheet = buildSpreadsheetSheet('Report', hideZeroAllHiddenRows)
    expect(sheet.presentationState).toBe('all_confirmed_zero_hidden')
    expect(sheet.header?.lines).toEqual([...hideZeroAllHiddenLines, HIDE_ZERO_ALL_HIDDEN_STATE])
    expect(sheet.columns).toEqual([]); expect(sheet.rows).toEqual([])
    expect(isCurrentReportSheet(sheet)).toBe(true)
    expect(filterSheetRows(sheet, '', '1900-01-01', '2100-01-01')).toEqual([])
    expect(getAdditiveColumns(sheet)).toEqual([]); expect(calculateTotals([], [])).toEqual([])
    expect(getChartMeasureOptions(sheet)).toEqual([])
    expect(buildSpreadsheetChartData(sheet, sheet.rows, 0).points).toEqual([])
    const exported = buildSheetExportRows(sheet, [])
    expect(exported).toEqual([...hideZeroAllHiddenLines.map(line => [line]), [], [HIDE_ZERO_ALL_HIDDEN_STATE]])
    const csv = buildSpreadsheetCsv(exported)
    const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(restored).toEqual({ ...sheet, name: 'CSV' })
    expect(csv).not.toContain('Загальний підсумок')
  })
  it('accepts actual merged-empty cells, split provenance continuations and the metadata appendix pointer', () => {
    const rows = [...hideZeroAllHiddenLines.flatMap(line => line.startsWith('! Підсумки при') ? [[line.slice(0, 70), null], [line.slice(70), null]] : [[line, null]]),
      ['Докладні примітки: повний текст збережено на аркуші «Примітки».', null], [], [HIDE_ZERO_ALL_HIDDEN_STATE, null]]
    const sheet = buildSpreadsheetSheet('Report', rows)
    expect(sheet.presentationState).toBe('all_confirmed_zero_hidden')
    expect(sheet.header?.lines).toContain(hideZeroAllHiddenLines.at(-1)!.slice(70))
  })
  it.each(['duplicate', 'duplicate-cell', 'conflict', 'single-conflict', 'header-after', 'data-after', 'subtotal-after', 'grand-after', 'table-before', 'neighbor', 'no-metadata', 'wrong-source', 'no-utc', 'historical', 'no-proof-note', 'duplicate-grouping', 'wrong-grouping', 'wrong-measure', 'no-source-data'])('refuses malformed or contradictory state without silently deleting cells: %s', scenario => {
    let rows = structuredClone(hideZeroAllHiddenRows)
    if (scenario === 'duplicate') rows.push([HIDE_ZERO_ALL_HIDDEN_STATE])
    if (scenario === 'duplicate-cell') rows[rows.length - 1][1] = HIDE_ZERO_ALL_HIDDEN_STATE
    if (scenario === 'conflict') rows.push(['Стан звіту: дані джерела відсутні'])
    if (scenario === 'single-conflict') rows[rows.length - 1] = ['Стан звіту: дані джерела відсутні']
    if (scenario === 'header-after') rows.push(['Запис залишку рахунку', 'Записаний залишок рахунку'])
    if (scenario === 'data-after') rows.push(['Запис залишку [40964]', 0])
    if (scenario === 'subtotal-after') rows.push(['Підсумок: A', 0])
    if (scenario === 'grand-after') rows.push(['Загальний підсумок', 0])
    if (scenario === 'table-before') rows.splice(rows.length - 1, 0, ['Запис залишку [40964]', null])
    if (scenario === 'neighbor') rows[rows.length - 1][1] = 'Не можна втратити ці дані'
    if (scenario === 'no-metadata') rows = [[hideZeroAllHiddenLines[0]], [], [HIDE_ZERO_ALL_HIDDEN_STATE]]
    if (scenario === 'wrong-source') rows[0] = ['Звіт поточної заборгованості']
    if (scenario === 'no-utc') rows = rows.filter(row => !String(row[0]).startsWith('Час читання'))
    if (scenario === 'historical') rows.splice(3, 0, ['Період: 01.01.2026 – 01.02.2026'])
    if (scenario === 'no-proof-note') rows = rows.filter(row => !String(row[0]).includes('Покриття приховування нулів:'))
    if (scenario === 'duplicate-grouping') rows.splice(4, 0, ['Рядки: Рахунок'])
    if (scenario === 'wrong-grouping') rows[3] = ['Рядки: Рахунок']
    if (scenario === 'wrong-measure') rows[5] = ['Показники: Записана заборгованість']
    if (scenario === 'no-source-data') rows.splice(rows.length - 2, 0, ['За вибраними умовами даних не знайдено'])
    const original = structuredClone(rows)
    expect(() => buildSpreadsheetSheet('Report', rows)).toThrow(/Некоректний стан звіту/)
    expect(rows).toEqual(original)
  })
  it('does not infer hidden records from an ordinary empty file or an unrelated user CSV marker', () => {
    const arbitrary = buildSpreadsheetSheet('CSV', [['User document'], [HIDE_ZERO_ALL_HIDDEN_STATE]], 'flat')
    expect(arbitrary.presentationState).toBeUndefined()
    expect(arbitrary.rows[0].cells).toContain(HIDE_ZERO_ALL_HIDDEN_STATE)
    const empty: SpreadsheetCellValue[][] = [...hideZeroAllHiddenLines.map(line => [line]), ['За вибраними умовами даних не знайдено'], [],
      ['Запис залишку рахунку', 'Залишки рахунків'], ['Запис залишку рахунку', 'Записаний залишок рахунку']]
    const sheet = buildSpreadsheetSheet('Report', empty)
    expect(sheet.presentationState).toBeUndefined()
    expect(sheet.header?.lines).toContain('За вибраними умовами даних не знайдено')
    expect(sheet.rows).toEqual([])
  })
  it('never performs client zero suppression, net-sum arithmetic or unknown-value repair in an ordinary file', () => {
    const rows: SpreadsheetCellValue[][] = [...hideZeroAllHiddenLines.slice(0, 14).map(line => [line]), [],
      ['Запис залишку рахунку', 'Залишки рахунків'], ['Запис залишку рахунку', 'Записаний залишок рахунку'],
      ['Запис залишку [1]', 10], ['Запис залишку [2]', -10], ['Запис залишку [3]', 0], ['Запис залишку [4]', null], ['Загальний підсумок', null]]
    const sheet = buildSpreadsheetSheet('Report', rows), csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
    const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
    expect(sheet.presentationState).toBeUndefined()
    expect(sheet.rows.filter(row => row.kind === 'data')).toHaveLength(4)
    expect(buildSpreadsheetChartData(sheet, sheet.rows, 1).points.map(point => point.value)).toEqual([10, -10, 0, null])
    expect(restored.rows.at(-1)?.cells[1]).toBe('')
  })
  it('preserves ordinary report cell text beginning with the state prefix without treating it as a metadata-only state', () => {
    const rows = [...hideZeroAllHiddenLines.slice(0, 14).map(line => [line]), [],
      ['Запис залишку рахунку', 'Залишки рахунків'], ['Запис залишку рахунку', 'Записаний залишок рахунку'],
      ['Стан звіту: довільна назва [1]', 10], ['Загальний підсумок', 10]]
    const sheet = buildSpreadsheetSheet('Report', rows)
    expect(sheet.presentationState).toBeUndefined()
    expect(sheet.rows[0].cells).toEqual(['Стан звіту: довільна назва [1]', 10])
  })
  it('refuses export if an explicit empty presentation is paired with actual rows or totals', () => {
    const sheet = buildSpreadsheetSheet('Report', hideZeroAllHiddenRows)
    expect(() => buildSheetExportRows(sheet, [{ kind: 'data', cells: ['record', 0] }])).toThrow(/суперечить/)
    expect(() => buildSheetExportRows(sheet, [], ['Загальний підсумок', 0])).toThrow(/суперечить/)
  })
})
