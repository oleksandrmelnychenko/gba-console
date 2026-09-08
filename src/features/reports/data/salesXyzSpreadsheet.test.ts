import { describe, expect, it } from 'vitest'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, detectDelimiter, filterSheetRows, getAdditiveColumns, getSpreadsheetNumberFormatter, parseDelimitedText } from '../spreadsheet'
import { buildSpreadsheetCsv } from '../utils'
import { buildSpreadsheetChartData } from './spreadsheetChartData'
import { getReportHeaderPresentation } from '../pages/reportHeaderPresentation'
import { salesXyzRows } from './salesXyz.test-fixtures'
import { XYZ_NOTE_PREFIXES } from './salesXyzSpreadsheet'
const canonical = (rows: ReturnType<typeof buildSpreadsheetSheet>['rows']) => rows.map(row => ({ kind: row.kind, cells: row.cells.map(cell => cell ?? '') }))
const reload = (csv: string) => buildSpreadsheetSheet('CSV', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
describe('XYZ file profile, independent values and selected exports', () => {
  it.each(Array.from({ length: 7 }, (_, i) => i + 1).flatMap(mask => ['known', 'empty', 'unknown', 'raw-rounding'].map(kind => ({ mask, kind: kind as Parameters<typeof salesXyzRows>[0] }))))('round-trips $kind mask$mask preserving server blanks, classes and full attribution', ({ mask, kind }) => {
    const selected = [0, 1, 2].filter(i => mask & 1 << i), sheet = buildSpreadsheetSheet('XYZ', salesXyzRows(kind, selected))
    const before = structuredClone(sheet)
    expect(sheet.columns.length).toBe(2 + selected.length)
    expect(getAdditiveColumns(sheet)).toEqual(sheet.columns.map(() => false))
    expect(calculateTotals(sheet.rows, getAdditiveColumns(sheet))).toEqual(sheet.columns.map(() => null))
    const again = reload(buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows)))
    expect(again.header).toEqual(sheet.header); expect(again.columns).toEqual(sheet.columns); expect(canonical(again.rows)).toEqual(canonical(sheet.rows))
    const filtered = filterSheetRows(sheet, 'Товар [10]', '', '')
    expect(filtered.every(r => r.kind === 'data')).toBe(true)
    expect(canonical(reload(buildSpreadsheetCsv(buildSheetExportRows(sheet, filtered))).rows)).toEqual(canonical(filtered))
    for (const [offset, selectedKind] of selected.entries()) {
      const formatter = getSpreadsheetNumberFormatter(sheet, offset + 2, true)!
      expect(formatter.format(40.82)).toBe(selectedKind === 2 ? '40.820' : '40.82')
      expect(buildSpreadsheetChartData(sheet, sheet.rows, offset + 2).points.map(p => p.value)).toEqual(sheet.rows.filter(r => r.kind === 'data').map(r => r.cells[offset + 2] ?? null))
    }
    expect(sheet).toEqual(before)
  })
  it('retains raw 0.01 aggregate while both rounded leaves are zero', () => {
    const sheet = buildSpreadsheetSheet('XYZ', salesXyzRows('raw-rounding'))
    expect(sheet.rows.filter(r => r.kind === 'data').map(r => r.cells[2])).toEqual([0, 0])
    expect(sheet.rows.at(-1)!.cells.slice(2)).toEqual([0.01, null, null])
    expect(calculateTotals(sheet.rows, getAdditiveColumns(sheet))[2]).toBeNull()
  })
  it('joins exactly nine physical notes for display without mutating CSV attribution', () => {
    const raw = salesXyzRows(), index = raw.findIndex(r => String(r[0]).startsWith('! Основа XYZ:'))
    raw.splice(index + 1, 0, ['продовження тієї самої примітки', 'продовження тієї самої примітки'])
    const sheet = buildSpreadsheetSheet('XYZ', raw), before = structuredClone(sheet.header)
    const display = getReportHeaderPresentation(sheet.header!)
    expect(display.warnings).toHaveLength(9)
    expect(display.lines.find(l => l.startsWith('! Основа XYZ:'))).toContain('продовження тієї самої примітки')
    expect(sheet.header).toEqual(before)
  })
  it.each(XYZ_NOTE_PREFIXES)('rejects incomplete attribution missing %s', prefix => {
    const rows = salesXyzRows().filter(row => !String(row[0]).startsWith('! ' + prefix))
    expect(() => buildSpreadsheetSheet('XYZ', rows)).toThrow('Некоректний файл XYZ')
  })
  it.each(['subtotal-mean', 'grand-cv', 'precision', 'cv-negative', 'unknown-mean', 'class', 'column-header', 'empty-grand', 'published-range'])('rejects altered shape %s', mode => {
    const rows = salesXyzRows(mode === 'unknown-mean' ? 'unknown' : mode === 'empty-grand' ? 'empty' : 'known')
    const leaf = rows.find(row => row[1] === 'Товар [6]')
    if (mode === 'subtotal-mean') rows.find(row => row[0] === 'Підсумок: Y')![3] = 100
    if (mode === 'grand-cv') rows.at(-1)![4] = 40.82
    if (mode === 'precision') leaf![4] = 40.821
    if (mode === 'published-range') leaf![2] = 10000000000000
    if (mode === 'cv-negative') leaf![4] = -1
    if (mode === 'unknown-mean') rows.find(row => row[0] === 'Невідомо')![3] = 0
    if (mode === 'class') leaf![0] = 'A'
    if (mode === 'column-header') rows.find(row => row[0] === 'Клас XYZ')![4] = 'Частка'
    if (mode === 'empty-grand') rows.push(['Загальний підсумок', '', 0, null, null])
    expect(() => buildSpreadsheetSheet('XYZ', rows)).toThrow('Некоректний файл XYZ')
  })
})
