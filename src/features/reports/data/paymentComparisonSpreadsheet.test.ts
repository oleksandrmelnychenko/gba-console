import { expect, it } from 'vitest'
import { buildSpreadsheetSheet, getAdditiveColumns, getSpreadsheetNumberFormatter, supportsSpreadsheetDateFilters } from '../spreadsheet'
import { buildSpreadsheetChartData } from './spreadsheetChartData'
import { paymentRows } from './paymentComparison.test-fixtures'
import { PAYMENT_COMPARISON_EMPTY_STATE, PAYMENT_COMPARISON_NOTE_PREFIXES } from './paymentComparisonSpreadsheet'

it.each(Array.from({ length: 15 }, (_, index) => index + 1))('preserves selected source21 mask%i, both subtotal levels and formatting', mask => {
  const selected = [0, 1, 2, 3].filter(index => mask & (1 << index)).reverse()
  const sheet = buildSpreadsheetSheet('payments', paymentRows('known', selected))
  expect(sheet.rows.map(row => row.kind)).toEqual(['data', 'subtotal', 'subtotal', 'total'])
  expect(sheet.rows[0].cells.slice(3)).toEqual(selected.map(index => [120, 80, 40, 50][index]))
  expect(sheet.rows[1].cells.slice(0, 3)).toEqual(['EUR [2]', 'Підсумок: Клієнт [101]', ''])
  expect(getAdditiveColumns(sheet).some(Boolean)).toBe(false); expect(supportsSpreadsheetDateFilters(sheet)).toBe(false)
  selected.forEach((kind, offset) => {
    expect(getSpreadsheetNumberFormatter(sheet, offset + 3, true)!.format(Number(sheet.rows[0].cells[offset + 3])))
      .toBe([120, 80, 40, 50][kind].toFixed(kind === 3 ? 2 : 4))
    expect(buildSpreadsheetChartData(sheet, sheet.rows, offset + 3).points).toHaveLength(1)
  })
})
it.each(['mixed', 'current-unknown', 'previous-unknown', 'both-unknown', 'unknown-currency', 'empty'] as const)('preserves unknown/empty shape %s', kind => {
  const sheet = buildSpreadsheetSheet(kind, paymentRows(kind))
  if (kind === 'empty') { expect(sheet.rows).toEqual([]); expect(sheet.header?.lines).toContain(PAYMENT_COMPARISON_EMPTY_STATE) }
  else if (kind === 'mixed') expect(sheet.rows.at(-1)?.cells.slice(3)).toEqual([null, null, null, null])
  else expect(sheet.rows[0].cells.slice(3)).toEqual(kind === 'current-unknown' ? [null, 80, null, null]
    : kind === 'previous-unknown' ? [120, null, null, null] : [null, null, null, null])
})
it.each(PAYMENT_COMPARISON_NOTE_PREFIXES)('requires owned attribution %s', prefix => {
  const rows = paymentRows().filter(row => !String(row[0]).startsWith(`! ${prefix}`))
  expect(() => buildSpreadsheetSheet('invalid', rows)).toThrow(/Некоректний файл/)
})
it.each([0, 1, 2, 3])('rejects invalid selected precision or relative limit at offset%i', index => {
  const rows = paymentRows(), first = rows.find(row => row[0] === 'EUR [2]' && row[2] === 'Договір [201]')!
  first[index + 3] = index === 3 ? 99999999999999 : 1.00001
  expect(() => buildSpreadsheetSheet('invalid', rows)).toThrow()
})
it('accepts exact four-place money above an unrelated two-decimal report ceiling', () => {
  const rows = paymentRows('known', [0]), first = rows.find(row => row[2] === 'Договір [201]')!
  first[3] = 100000000000000
  expect(buildSpreadsheetSheet('large', rows).rows[0].cells[3]).toBe(100000000000000)
})
it('rejects known values in an unknown currency or mixed-currency grand even when one currency contains only zero', () => {
  const unknown = paymentRows('unknown-currency'); unknown.find(row => row[2] === 'Договір [201]')![3] = 0
  expect(() => buildSpreadsheetSheet('unknown', unknown)).toThrow()
  const mixed = paymentRows('mixed'); mixed.at(-1)![3] = 120
  expect(() => buildSpreadsheetSheet('mixed', mixed)).toThrow()
})
it('keeps reserved-looking captions as leaves when all three identities are explicit, without collapsing equal labels', () => {
  const rows = paymentRows(), first = rows.find(row => row[2] === 'Договір [201]')!
  first[0] = 'Підсумок: EUR [2]'; first[1] = 'Невідомо [2]'; first[2] = 'Невідомо [2]'
  const sheet = buildSpreadsheetSheet('captions', rows)
  expect(sheet.rows[0]).toEqual({ kind: 'data', cells: first })
})
it.each(['', null, 'EUR', 'EUR [02]', 'EUR [0]', 'EUR [9223372036854775808]'])('refuses incomplete or invalid currency identity %j without carrying prior axes', value => {
  const rows = paymentRows(), first = rows.find(row => row[2] === 'Договір [201]')!; first[0] = value
  expect(() => buildSpreadsheetSheet('identity', rows)).toThrow()
})
it('retains exact large nullable identity buckets and forbids an invented empty grand', () => {
  const rows = paymentRows(), first = rows.find(row => row[2] === 'Договір [201]')!
  first[1] = 'Невідомо'; first[2] = 'Невідомо [9007199254740993]'
  expect(buildSpreadsheetSheet('nullable', rows).rows[0].cells.slice(1, 3)).toEqual(['Невідомо', 'Невідомо [9007199254740993]'])
  const empty = paymentRows('empty'); empty.push(['Загальний підсумок', '', '', 0, 0, 0, 100])
  expect(() => buildSpreadsheetSheet('empty', empty)).toThrow()
})
it('rejects inconsistent selected derivative knownness but does not recompute from rounded operands', () => {
  const invalid = paymentRows('current-unknown'); invalid.find(row => row[2] === 'Договір [201]')![5] = 1
  expect(() => buildSpreadsheetSheet('invalid', invalid)).toThrow()
  const raw = paymentRows(), first = raw.find(row => row[2] === 'Договір [201]')!; first.splice(3, 4, 1, 3, -2, -66.67)
  expect(buildSpreadsheetSheet('raw', raw).rows[0].cells.slice(3)).toEqual([1, 3, -2, -66.67])
})
