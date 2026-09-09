import { describe, expect, it } from 'vitest'
import { buildSheetExportRows, buildSpreadsheetSheet, calculateTotals, filterSheetRows, getAdditiveColumns, getSpreadsheetNumberFormatter, parseDelimitedText } from './spreadsheet'
import { rateRows, rateSeriesCaption } from './data/rateComparison.test-fixtures'
import { RATE_COMPARISON_NOTE_PREFIXES, readRateSeriesIdentity } from './data/rateComparisonSpreadsheet'
import { buildSpreadsheetChartData } from './data/spreadsheetChartData'
import { buildSpreadsheetCsv } from './utils'

describe('source19 one exact series without totals', () => {
  it.each(['known', 'negative', 'zero', 'current-unknown', 'previous-unknown', 'both-unknown', 'raw-rounding'])('preserves %s across XLSX/CSV/chart with no computed total', kind => {
    const sheet = buildSpreadsheetSheet('Курс', rateRows(kind)), additive = getAdditiveColumns(sheet)
    expect(sheet.rows).toHaveLength(1); expect(sheet.rows[0].kind).toBe('data'); expect(additive).toEqual([false, false, false, false, false]); expect(calculateTotals(sheet.rows, additive)).toEqual([null, null, null, null, null])
    const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows)), restored = buildSpreadsheetSheet('CSV', parseDelimitedText(csv, ','), 'flat')
    expect(restored.rows.map(row => row.cells.map(cell => cell ?? ''))).toEqual(sheet.rows.map(row => row.cells.map(cell => cell ?? ''))); expect(restored.header?.lines).toEqual(sheet.header?.lines); expect(csv).not.toContain('Загальний підсумок')
    for (let column = 1; column <= 4; column++) { const chart = buildSpreadsheetChartData(sheet, sheet.rows, column); expect(chart.points[0]).toMatchObject({ label: rateSeriesCaption, value: sheet.rows[0].cells[column] }); expect(chart.unknownCount).toBe(sheet.rows[0].cells[column] == null ? 1 : 0) }
  })
  it('refuses supplied totals on source19 CSV export', () => {
    const sheet = buildSpreadsheetSheet('Курс', rateRows()); expect(() => buildSheetExportRows(sheet, sheet.rows, ['Разом', 42.5, 40, 2.5, 6.25])).toThrow()
  })
  it('formats rates/delta4dp and percentage2dp; preserves rounded raw-derived values without recomputing', () => {
    const sheet = buildSpreadsheetSheet('Курс', rateRows('raw-rounding'))
    expect([1, 2, 3, 4].map(column => getSpreadsheetNumberFormatter(sheet, column, true)?.format(Number(sheet.rows[0].cells[column])))).toEqual(['0.0001', '0.0000', '0.0000', '50.00'])
    expect(getSpreadsheetNumberFormatter(sheet, 0)).toBeUndefined()
  })
  it('keeps selected mask order for each nonempty subset', () => {
    for (let mask = 1; mask < 16; mask++) { const fields = [3, 1, 2, 0].filter(index => mask & (1 << index)); const rows = rateRows('known', fields), sheet = buildSpreadsheetSheet('Курс', rows); expect(sheet.rows[0].cells).toEqual(rows.at(-1)) }
  })
  it('ignores event-date filters and produces a valid empty filtered CSV without manufacturing a row', () => {
    const sheet = buildSpreadsheetSheet('Курс', rateRows())
    expect(filterSheetRows(sheet, '', '9998-01-01', '9998-12-31')).toEqual(sheet.rows)
    const rows = filterSheetRows(sheet, 'unmatched', '', '')
    expect(rows).toEqual([])
    const restored = buildSpreadsheetSheet('CSV', parseDelimitedText(buildSpreadsheetCsv(buildSheetExportRows(sheet, rows)), ','), 'flat')
    expect(restored.rows).toEqual([]); expect(getAdditiveColumns(restored)).toEqual([false, false, false, false, false])
  })
  it.each(['Загальний підсумок', 'Підсумок: Валютна пара'])('refuses forged %s', label => {
    const rows = rateRows(); rows.push([label, 42.5, 40, 2.5, 6.25]); expect(() => buildSpreadsheetSheet('bad', rows)).toThrow()
  })
  it.each(['duplicate', 'different-series', 'identity', 'unknown-filled', 'known-blank', 'negative-rate', 'precision', 'text', 'infinity', 'max', 'metadata-adjacent', 'empty-workbook', 'title', 'caption', 'measure-order'])('refuses malformed %s', kind => {
    const rows = rateRows(), leaf = rows.at(-1)!
    if (kind === 'duplicate') rows.push([...leaf])
    if (kind === 'different-series') leaf[0] = rateSeriesCaption.replace('9007199254740993', '9007199254740994')
    if (kind === 'identity') leaf[0] = 'EUR/UAH'
    if (kind === 'unknown-filled') rows[10] = ['! Поточний запис: відсутній']
    if (kind === 'known-blank') leaf[1] = null
    if (kind === 'negative-rate') leaf[1] = -1
    if (kind === 'precision') leaf[1] = 1.12345
    if (kind === 'text') leaf[1] = '42.5000'
    if (kind === 'infinity') leaf[1] = Infinity
    if (kind === 'max') leaf[1] = 100000000000
    if (kind === 'metadata-adjacent') rows[0].push('different')
    if (kind === 'empty-workbook') rows.pop()
    if (kind === 'title') rows[0] = ['Звіт продажів']
    if (kind === 'caption') rows.at(-2)![1] = 'Другий курс'
    if (kind === 'measure-order') [rows.at(-2)![1], rows.at(-2)![2]] = [rows.at(-2)![2], rows.at(-2)![1]]
    expect(() => buildSpreadsheetSheet('bad', rows)).toThrow()
  })
  it.each(RATE_COMPARISON_NOTE_PREFIXES)('requires exactly one %s attribution', prefix => {
    const rows = rateRows(), index = rows.findIndex(row => String(row[0]).startsWith('! ' + prefix)); rows.splice(index, 1); expect(() => buildSpreadsheetSheet('bad', rows)).toThrow()
    const duplicate = rateRows(); duplicate.splice(4, 0, [...duplicate[index]]); expect(() => buildSpreadsheetSheet('bad', duplicate)).toThrow()
  })
  it('uses IDs rather than names and validates canonical currency/pair/definition identity', () => {
    expect(readRateSeriesIdentity(rateSeriesCaption)).not.toBeNull()
    expect(readRateSeriesIdentity(rateSeriesCaption.replace('CurrencyID=3', 'CurrencyID=2'))).toBeNull()
    expect(readRateSeriesIdentity(rateSeriesCaption.replace('9007199254740993', '9223372036854775808'))).toBeNull()
    expect(readRateSeriesIdentity(rateSeriesCaption.replace('9007199254740993', '09007199254740993'))).toBeNull()
  })
  it('does not recognize rate-like text in legacy report body', () => {
    const sheet = buildSpreadsheetSheet('plain', [['Name', 'Value'], ['Курс на поточну дату', 3]], 'flat'); expect(sheet.header).toBeNull(); expect(sheet.rows).toHaveLength(1)
  })
})
