import { describe, expect, it } from 'vitest'
import { canTransferReportGrouping, reorderReportGrouping, transferReportGrouping } from './reportGroupingLayout'

const warehouse = { type: 29, key: 'StockWarehouse', label: 'Склад' }
const unit = { type: 28, key: 'ProductMeasureUnit', label: 'Одиниця виміру' }
const price = { type: 26, key: 'SalesUnitGrossPrice', label: 'Ціна з ПДВ' }
const allowed = new Set([28,29,26])

describe('exact report grouping order', () => {
  it('reorders supported identities without changing fields, the input, or legacy price type 26', () => {
    const original = [warehouse, unit, price]
    expect(reorderReportGrouping(original,26,-1,allowed)).toEqual([warehouse,price,unit])
    expect(reorderReportGrouping(original,29,1,allowed)).toEqual([unit,warehouse,price])
    expect(original).toEqual([warehouse,unit,price])
    expect(reorderReportGrouping(original,26,1,allowed)).toBe(original)
    expect(reorderReportGrouping(original,29,-1,allowed)).toBe(original)
    expect(reorderReportGrouping(original,26,-1,new Set([28,29]))).toBe(original)
  })
  it('transfers one exact identity to the other axis and retains original object references', () => {
    const layout = { Row:[warehouse,unit], Col:[price] }
    const next = transferReportGrouping(layout,'Row',29,allowed)
    expect(next).toEqual({Row:[unit],Col:[price,warehouse]})
    expect(next.Col[1]).toBe(warehouse)
    expect(layout).toEqual({Row:[warehouse,unit],Col:[price]})
    expect(transferReportGrouping(next,'Col',26,allowed)).toEqual({Row:[unit,price],Col:[warehouse]})
  })
  it('refuses a duplicate destination, ambiguous imported identity, unsupported type or last row without erasing any field', () => {
    const cases = [
      {layout:{Row:[warehouse,unit],Col:[warehouse]},type:29,allowed},
      {layout:{Row:[warehouse,warehouse,unit],Col:[]},type:29,allowed},
      {layout:{Row:[warehouse,unit],Col:[]},type:29,allowed:new Set([28])},
      {layout:{Row:[unit],Col:[warehouse]},type:28,allowed},
    ]
    for(const item of cases) {
      expect(canTransferReportGrouping(item.layout,'Row',item.type,item.allowed)).toBe(false)
      expect(transferReportGrouping(item.layout,'Row',item.type,item.allowed)).toBe(item.layout)
    }
  })
})
