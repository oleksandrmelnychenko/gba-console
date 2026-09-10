import { expect, it } from 'vitest'
import { buildSpreadsheetSheet, buildSheetExportRows, getAdditiveColumns, getSpreadsheetNumberFormatter, supportsSpreadsheetDateFilters, parseDelimitedText, detectDelimiter, filterSheetRows } from '../spreadsheet'
import { buildSpreadsheetCsv } from '../utils'
import { agreementPricesRows } from './agreementPrices.test-fixtures'
import { AGREEMENT_PRICES_NOTE_PREFIXES } from './agreementPrices'
import { buildSpreadsheetChartData } from './spreadsheetChartData'

it('preserves exact unit prices, zero and unknown through workbook, filtered CSV and chart', () => {
  const sheet = buildSpreadsheetSheet('prices', agreementPricesRows())
  expect(sheet.rows.map(row => row.cells[2])).toEqual([12.1234567890123, 0, null])
  expect(getAdditiveColumns(sheet)).toEqual([false, false, false])
  expect(supportsSpreadsheetDateFilters(sheet)).toBe(false)
  expect(getSpreadsheetNumberFormatter(sheet, 2, true)?.format(12.1234567890123)).toBe('12.1234567890123')
  const csv = buildSpreadsheetCsv(buildSheetExportRows(sheet, sheet.rows))
  const reloaded = buildSpreadsheetSheet('csv', parseDelimitedText(csv, detectDelimiter(csv)), 'flat')
  expect(reloaded.rows.map(row => row.cells[2] === '' ? null : row.cells[2])).toEqual([12.1234567890123, 0, null])
  expect(getAdditiveColumns(reloaded)).toEqual([false, false, false])
  const selected = filterSheetRows(sheet, 'Товар B', '', '')
  expect(selected).toHaveLength(1)
  expect(buildSheetExportRows(sheet, selected).flat()).not.toContain('Загальний підсумок')
  expect(buildSpreadsheetChartData(sheet, sheet.rows, 2).points.map(point => point.value)).toEqual([12.1234567890123, 0, null])
})
it('accepts a complete empty selection without adding a zero price or total', () => {
  const sheet = buildSpreadsheetSheet('empty', agreementPricesRows(true))
  expect(sheet.rows).toEqual([])
  expect(getAdditiveColumns(sheet)).toEqual([false, false, false])
})
it('handles absent unknown XLSX cells and blank styled columns without discarding extra data', () => {
  const absent = agreementPricesRows(); absent.at(-1)!.pop()
  expect(buildSpreadsheetSheet('sparse', absent).rows.at(-1)!.cells[2]).toBeNull()
  const styled = agreementPricesRows().map(row => [...row, null])
  expect(buildSpreadsheetSheet('styled', styled).rows.map(row => row.cells[2])).toEqual([12.1234567890123, 0, null])
  styled.at(-1)![3] = 'Unexpected data'
  expect(() => buildSpreadsheetSheet('bad', styled)).toThrow(/цін/)
})
it.each(AGREEMENT_PRICES_NOTE_PREFIXES)('requires source price metadata %s', prefix => {
  expect(() => buildSpreadsheetSheet('bad', agreementPricesRows().filter(row => !String(row[0]).startsWith(prefix)))).toThrow(/цін/)
})
it('rejects total rows and attempts to export a sum of prices', () => {
  const raw = agreementPricesRows(); raw.push(['Загальний підсумок', '', 12.1234567890123])
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/цін/)
  const sheet = buildSpreadsheetSheet('prices', agreementPricesRows())
  expect(() => buildSheetExportRows(sheet, sheet.rows, ['', '', 12.1234567890123])).toThrow(/підсумки/)
})
it.each([99.1, 0.01, 12345.67, 0.00000000000001, 999999999999999, 123456789012.345])('accepts publishable decimal quote %s without binary rounding artefacts', price => {
  const raw = agreementPricesRows(); raw.at(-3)![2] = price
  expect(buildSpreadsheetSheet('prices', raw).rows[0].cells[2]).toBe(price)
})
it.each([-1, NaN, Infinity, 'not a price', 1.123456789012345, 0.000000000000001, 1000000000000000])('rejects invalid quote %s', price => {
  const raw = agreementPricesRows(); raw.at(-3)![2] = price
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/цін/)
})
it('refuses price metadata with a changed title, dates, or duplicate products', () => {
  const raw = agreementPricesRows(); raw[0] = ['Інший звіт']
  expect(() => buildSpreadsheetSheet('bad', raw)).toThrow(/цін/)
  const dated = agreementPricesRows(); dated.splice(3, 0, ['Період: 01.09.2026 – 10.09.2026'])
  expect(() => buildSpreadsheetSheet('bad', dated)).toThrow(/цін/)
  const duplicate = agreementPricesRows(); duplicate.push(duplicate.at(-1)!)
  expect(() => buildSpreadsheetSheet('bad', duplicate)).toThrow(/цін/)
})
