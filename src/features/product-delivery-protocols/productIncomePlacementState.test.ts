import { describe, expect, it } from 'vitest'
import { isInvoiceAllNotPlaced } from './productIncomePlacementState'
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
