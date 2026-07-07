import { describe, expect, it } from 'vitest'
import { createIncomeDynamicPlacementColumn, isInvoiceAllNotPlaced } from './productIncomePlacementState'
import type { IncomePackingList, IncomeSupplyInvoice } from './productIncomeTypes'

function packingList(NetUid: string, isPlacedItems: boolean[]): IncomePackingList {
  return {
    DynamicProductPlacementColumns: [],
    NetUid,
    PackingListPackageOrderItems: isPlacedItems.map((IsPlaced, index) => ({ Id: index + 1, IsPlaced })),
  }
}

function invoice(packingLists: IncomePackingList[]): IncomeSupplyInvoice {
  return { PackingLists: packingLists }
}

describe('product income placement state', () => {
  it('creates new income dynamic columns with item-bound zero rows', () => {
    const list: IncomePackingList = {
      Id: 42,
      DynamicProductPlacementColumns: [],
      PackingListPackageOrderItems: [
        { Id: 7, Qty: 2 },
        { Id: 8, Qty: 3 },
      ],
    }

    const column = createIncomeDynamicPlacementColumn(list, '2026-07-06T00:00:00')

    expect(column).toMatchObject({
      FromDate: '2026-07-06T00:00:00',
      PackingListId: 42,
    })
    expect(column.DynamicProductPlacementRows).toHaveLength(2)
    expect(column.DynamicProductPlacementRows[0]).toMatchObject({
      Qty: 0,
      PackingListPackageOrderItemId: 7,
      PackingListPackageOrderItem: list.PackingListPackageOrderItems[0],
      DynamicProductPlacements: [],
    })
    expect(column.DynamicProductPlacementRows[1]).toMatchObject({
      Qty: 0,
      PackingListPackageOrderItemId: 8,
      PackingListPackageOrderItem: list.PackingListPackageOrderItems[1],
      DynamicProductPlacements: [],
    })
  })

  it('allows income date editing while every invoice item is not placed', () => {
    expect(isInvoiceAllNotPlaced(invoice([
      packingList('pl-1', [false, false]),
      packingList('pl-2', [false]),
    ]))).toBe(true)
  })

  it('locks income date editing after any item under the invoice is placed', () => {
    expect(isInvoiceAllNotPlaced(invoice([
      packingList('pl-1', [false, false]),
      packingList('pl-2', [true]),
    ]))).toBe(false)
  })

  it('uses the currently loaded packing list state when it is more recent than the invoice copy', () => {
    const staleInvoice = invoice([packingList('pl-1', [false])])
    const loadedPackingList = packingList('pl-1', [true])

    expect(isInvoiceAllNotPlaced(staleInvoice, loadedPackingList)).toBe(false)
  })
})
