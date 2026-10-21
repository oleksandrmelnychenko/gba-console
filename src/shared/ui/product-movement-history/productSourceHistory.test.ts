import { describe, expect, it } from 'vitest'
import { buildProductIncomeMovementTree } from './productIncomeMovementTree'
import { formatSourceHistoryMoney, withProductSourceHistoryColumns, type ProductSourceHistoryInfo } from './productSourceHistory'

const history: ProductSourceHistoryInfo = {
  RowKey: 'Fenix:277:doc:line:storage:income', SourceSystem: 'Fenix', SourceDocumentType: 277,
  HasCurrentBalance: false, HasPhysicalMovement: false, SourceUnitPrice: 23.45,
  SourceAmount: 46.9, SourceVatAmount: 7.82, SourceCurrency: 'UAH',
}
const t = (value: string) => value

describe('source document history presentation', () => {
  it('preserves real zero source prices and leaves unknown amounts blank', () => {
    expect(formatSourceHistoryMoney(0)).toBe('0')
    expect(formatSourceHistoryMoney(null)).toBe('—')
    expect(formatSourceHistoryMoney(undefined)).toBe('—')
    expect(formatSourceHistoryMoney(Number.NaN)).toBe('—')
  })

  it('keeps legacy financial values for local rows and excludes them for archive rows', () => {
    const columns = withProductSourceHistoryColumns<{ SourceHistory?: ProductSourceHistoryInfo }>([
      { id: 'netPrice', header: 'EUR', accessor: () => 999, cell: () => '999 EUR' },
      { id: 'remainingQty', header: 'Balance', accessor: () => 0, cell: () => '0' },
    ], t)
    const price = columns.find((column) => column.id === 'netPrice')!
    const balance = columns.find((column) => column.id === 'remainingQty')!
    expect(price.cell?.({})).toBe('999 EUR')
    expect(price.cell?.({ SourceHistory: history })).toBe('—')
    expect(price.accessor?.({ SourceHistory: history })).toBeUndefined()
    expect(balance.cell?.({})).toBe('0')
    expect(balance.cell?.({ SourceHistory: history })).toBe('—')
    expect(balance.cell?.({ SourceHistory: { ...history, HasCurrentBalance: true } })).toBe('0')
    expect(columns.find((column) => column.id === 'sourceHistory')?.cell?.({ SourceHistory: history }))
      .toBe('Історія 1С · Fenix · Без складського руху')
    expect(columns.find((column) => column.id === 'sourceDocumentCurrency')?.cell?.({ SourceHistory: history })).toBe('UAH')
  })

  it('does not fold historical documents with matching numbers and prices into source twins', () => {
    const document = { IncomeToStorageNumber: 'SAME', IncomeQty: 2, NetPrice: 0, Currency: 'UAH', SourceDocumentType: 3, SourceDocumentId: 'base64' }
    const rows = buildProductIncomeMovementTree([
      { ...document, ImportedForAmg: false, IsHide: true, SourceHistory: history },
      { ...document, ImportedForAmg: true, IsHide: false, SourceHistory: { ...history, RowKey: 'AMG:277:doc:line:storage:income', SourceSystem: 'AMG' } },
    ])
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.Branches.length === 1)).toBe(true)
    expect(rows.map((row) => row.TreeKey)).toEqual(expect.arrayContaining([
      expect.stringContaining(history.RowKey), expect.stringContaining('AMG:277:doc'),
    ]))
  })
})
