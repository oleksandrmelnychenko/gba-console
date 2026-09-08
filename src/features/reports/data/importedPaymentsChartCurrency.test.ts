import { describe, expect, it } from 'vitest'
import type { SpreadsheetRow, SpreadsheetSheet } from '../types'
import { IMPORTED_PAYMENTS_TITLE } from './importedPayments'
import { getPaymentChartCurrencyScope } from './importedPaymentsChartCurrency'

function sheet(rowGroups = ['Валюта рахунку'], columnGroups: string[] = [], values: unknown[][] = [['EUR [2]', 10.2501], ['UAH [10038]', 1000000], ['EUR [2]', null]]): SpreadsheetSheet {
  return { name: 'Report', header: { lines: [IMPORTED_PAYMENTS_TITLE], warnings: [], rowGroupings: rowGroups, columnGroupings: columnGroups },
    columns: [...rowGroups, 'Записані платежі · Різниця записаних платежів'], rows: values.map(cells => ({ kind: 'data', cells } as SpreadsheetRow)) }
}
const scope = (file: SpreadsheetSheet, measure = file.header!.rowGroupings.length) => getPaymentChartCurrencyScope(file, file.rows, measure)
describe('source14 chart currency proof', () => {
  it('keeps separate exact domains including zeros and unknown amounts; totals cannot add a domain', () => {
    const file = sheet(); file.rows.push({ kind: 'data', cells: ['USD [3]', 0] }, { kind: 'total', cells: ['GBP [9]', 300] })
    const result = scope(file)
    expect(result.status).toBe('ready'); expect(result.options.map(c => c.value)).toEqual(['2', '10038', '3'])
    expect(result.rowsByCurrency.get('2')!.map(row => row.cells[1])).toEqual([10.2501, null])
    expect(result.rowsByCurrency.get('3')![0].cells[1]).toBe(0)
    expect(file.rows).toHaveLength(5)
  })
  it('does not infer currency from a caption, contract, account ID or known amount when the axis is absent', () => {
    expect(scope(sheet(['Рахунок'], [], [['EUR account [2]', 10.2501]])).status).toBe('missing-axis')
  })
  it.each(['EUR', 'EUR [0]', 'EUR [02]', 'EUR [2] document', 'Не вказано', 2, null])('does not certify unknown or malformed row currency %s', value => {
    const result = scope(sheet(['Валюта рахунку'], [], [[value, 0]]))
    expect(result.options).toEqual([]); expect(result.rowsByCurrency.size).toBe(0); expect(result.unknownRows).toBe(1)
  })
  it('uses exact string IDs without rounding large IDs or merging equal currency names', () => {
    const result = scope(sheet(['Валюта рахунку'], [], [['EUR [9007199254740992]', 1], ['EUR [9007199254740993]', 2]]))
    expect(result.options.map(c => c.value)).toEqual(['9007199254740992', '9007199254740993'])
  })
  it('reads currency at its declared position in the selected pivot column only', () => {
    const file = sheet(['Договір'], ['Напрям платежу', 'Валюта рахунку'], [['Договір [201]', 1.2501, -2.2501]])
    file.columns = ['Договір', 'Надходження [1] · EUR [2] · Записані платежі · Різниця записаних платежів', 'Виплата [2] · UAH [10038] · Записані платежі · Різниця записаних платежів']
    expect(scope(file, 1).fixedCurrency?.value).toBe('2'); expect(scope(file, 2).fixedCurrency?.value).toBe('10038')
    expect(scope(file, 1).rowsByCurrency.get('2')).toEqual(file.rows)
  })
  it.each(['Не вказано · Записані платежі · Різниця записаних платежів', 'EUR [2] · extra [3] · Записані платежі · Різниця записаних платежів', 'EUR [2] · Other · Різниця записаних платежів'])('blocks unknown or ambiguous currency column %s', column => {
    const file = sheet(['Договір'], ['Валюта рахунку'], [['Договір [201]', 1]])
    file.columns[1] = column
    expect(scope(file).status).toBe('unknown-column')
  })
  it('blocks duplicate currency axes even when both labels have the same ID', () => {
    const file = sheet(['Валюта рахунку'], ['Валюта рахунку'], [['EUR [2]', 1]])
    file.columns[1] = 'EUR [2] · Записані платежі · Різниця записаних платежів'
    expect(scope(file).status).toBe('ambiguous-axis')
  })
  it('keeps proved empty report empty without inventing a currency', () => {
    const result = scope(sheet(['Договір'], [], []))
    expect(result.status).toBe('empty'); expect(result.options).toEqual([])
  })
})
