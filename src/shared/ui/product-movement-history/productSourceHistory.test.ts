import { describe, expect, it } from 'vitest'
import { buildProductIncomeMovementTree } from './productIncomeMovementTree'
import { getProductMovementRowKey, formatSourceHistoryMoney, withProductSourceHistoryColumns, type ProductSourceHistoryInfo, type ProductSourceHistoryRow } from './productSourceHistory'

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

const physical = {
  PublicationId: 'publication-1', World: 'Fenix', RecorderType: 288, RecorderId: 'recorder-1',
  LineNumber: 1, BatchValueType: '08', BatchTable: '00000115', BatchId: 'batch-1',
}

describe('physical movement presentation', () => {
  const columns = withProductSourceHistoryColumns<ProductSourceHistoryRow>([
    { id: 'price', header: 'Legacy cost', accessor: () => 999, cell: () => '999 EUR' },
    { id: 'remainingQty', header: 'Remaining', accessor: () => 0, cell: () => '0' },
  ], t)
  const cell = (id: string, row: ProductSourceHistoryRow) => columns.find(column => column.id === id)!.cell?.(row)

  it('hides every legacy cost even when a physical cost is confirmed', () => {
    const row = { PhysicalSource: physical, ValuationKnown: true, PhysicalSourceCostEur: 40, PhysicalSourceVatEur: 8 }
    expect(cell('price', row)).toBe('—')
    expect(cell('physicalMovementCost', row)).toBe('40')
    expect(cell('physicalMovementVat', row)).toBe('8')
    expect(cell('remainingQty', row)).toBe('—')
  })

  it('hides explicitly unknown native valuation without hiding its known remaining quantity', () => {
    expect(cell('price', { ValuationKnown: false })).toBe('—')
    expect(cell('remainingQty', { ValuationKnown: false })).toBe('0')
    expect(cell('price', { ValuationKnown: null })).toBe('999 EUR')
  })

  it.each([false, null, undefined])('does not admit physical monetary defaults with ValuationKnown=%s', ValuationKnown => {
    const row = { PhysicalSource: physical, ValuationKnown, PhysicalSourceCostEur: 0, PhysicalSourceVatEur: 0 }
    expect(cell('physicalMovementCost', row)).toBe('—')
    expect(cell('physicalMovementVat', row)).toBe('—')
  })

  it('preserves confirmed zero independently from absent VAT and never renders nonfinite values', () => {
    expect(cell('physicalMovementCost', { PhysicalSource: physical, ValuationKnown: true, PhysicalSourceCostEur: 0 })).toBe('0')
    expect(cell('physicalMovementVat', { PhysicalSource: physical, ValuationKnown: true, PhysicalSourceVatEur: null })).toBe('—')
    expect(cell('physicalMovementCost', { PhysicalSource: physical, ValuationKnown: true, PhysicalSourceCostEur: Infinity })).toBe('—')
  })

  it('uses complete physical identities before native IDs or captions and retains source line/batch distinctions', () => {
    const row = { PhysicalSource: physical, Id: 5, NetUid: 'legacy', SourceHistory: history }
    const key = getProductMovementRowKey(row, 'fallback')
    expect(getProductMovementRowKey(row, 'another-index')).toBe(key)
    expect(getProductMovementRowKey({ SourceHistory: { ...history, RowKey: '' }, NetUid: 'native' }, 'fallback')).toBe('native')
    for (const change of [{ LineNumber: 2 }, { BatchId: 'batch-2' }, { World: 'AMG' }, { PublicationId: 'publication-2' }]) {
      expect(getProductMovementRowKey({ ...row, PhysicalSource: { ...physical, ...change } }, 'fallback')).not.toBe(key)
    }
    expect(cell('sourceHistory', row)).toBe('Складський рух')
    expect(cell('sourceDocumentAmount', row)).toBe('—')
  })

  it('never pairs physical rows using matching legacy document values', () => {
    const same = { IncomeToStorageNumber: 'same', IncomeQty: 2, NetPrice: 0, Currency: 'EUR', SourceDocumentType: 277, SourceDocumentId: 'same' }
    const rows = [
      { ...same, PhysicalSource: physical, ImportedForAmg: false, IsHide: true },
      { ...same, PhysicalSource: { ...physical, BatchId: 'batch-2' }, ImportedForAmg: true, IsHide: false },
    ]
    const tree = buildProductIncomeMovementTree(rows)
    expect(tree).toHaveLength(2)
    expect(tree.every(row => row.Branches.length === 1)).toBe(true)
    expect(buildProductIncomeMovementTree([...rows].reverse()).map(row => row.TreeKey).sort()).toEqual(tree.map(row => row.TreeKey).sort())
  })

  it('keeps signed eight-decimal physical quantity visible while preserving native formatting', () => {
    const quantity = withProductSourceHistoryColumns<ProductSourceHistoryRow>([{ id: 'qty', header: 'Qty', accessor: () => -0.00000001, cell: () => 'legacy' }], t).find(column => column.id === 'qty')!
    expect(quantity.cell?.({ PhysicalSource: physical })).toBe('-0,00000001')
    expect(quantity.cell?.({})).toBe('legacy')
  })
})
