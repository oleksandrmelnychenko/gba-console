import { describe, expect, it } from 'vitest'
import {
  createIncomeDynamicPlacementColumn,
  createPackingListPlacementMutationPayload,
  getPlacementRowCapacity,
  getProductIncomePlacementState,
  isInvoiceAllNotPlaced,
  mergeSavedPlacementRow,
  selectIncomePackingList,
} from './productIncomePlacementState'
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

  it('preserves the canonical package graph when a placement column is added', () => {
    const canonicalList = {
      Id: 42,
      NetUid: 'fda4df3e-d952-42ff-9844-590442373f65',
      DynamicProductPlacementColumns: [],
      PackingListPackageOrderItems: [],
      PackingListBoxes: [{ Id: 70, PackingListPackageOrderItems: [{ Id: 7 }] }],
      InvoiceDocuments: [{ Id: 90 }],
    }
    const sourceInvoice: IncomeSupplyInvoice = {
      Id: 12,
      NetUid: '885b3a13-9cd9-4c89-ad49-703fa18fbac5',
      PackingLists: [canonicalList],
    }
    const editedList: IncomePackingList = {
      Id: 42,
      NetUid: canonicalList.NetUid,
      PackingListPackageOrderItems: [{ Id: 7 }],
      DynamicProductPlacementColumns: [
        {
          FromDate: '2026-08-04T00:00:00',
          DynamicProductPlacementRows: [],
        },
      ],
    }

    const payload = createPackingListPlacementMutationPayload(sourceInvoice, editedList)
    const submittedList = payload.PackingLists[0]

    expect(submittedList?.DynamicProductPlacementColumns).toBe(editedList.DynamicProductPlacementColumns)
    expect(submittedList?.PackingListPackageOrderItems).toBe(canonicalList.PackingListPackageOrderItems)
    expect(submittedList?.PackingListBoxes).toBe(canonicalList.PackingListBoxes)
    expect(submittedList?.InvoiceDocuments).toBe(canonicalList.InvoiceDocuments)
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

  it('keeps a draft without receipt evidence as not received', () => {
    expect(getProductIncomePlacementState(
      { IsFullyPlaced: false, IsPartiallyPlaced: false, PackingLists: [] },
      packingList('draft', [false]),
    )).toBe('draft')
  })

  it('derives a partial receipt from persisted item quantities when invoice flags are stale', () => {
    const partiallyReceived = packingList('partial', [false])
    partiallyReceived.PackingListPackageOrderItems[0].PlacedQty = 1

    expect(getProductIncomePlacementState(
      { IsFullyPlaced: false, IsPartiallyPlaced: false, PackingLists: [partiallyReceived] },
      partiallyReceived,
    )).toBe('partially-received')
  })

  it('keeps capitalize as a partial receipt until the invoice is fully placed', () => {
    expect(getProductIncomePlacementState(
      { IsFullyPlaced: false, IsPartiallyPlaced: true, PackingLists: [] },
      packingList('capitalized', [false]),
    )).toBe('partially-received')
  })

  it('treats carry-out as received even when no product income was created', () => {
    expect(getProductIncomePlacementState(
      { IsFullyPlaced: false, IsPartiallyPlaced: false, PackingLists: [] },
      { ...packingList('carried-out', [false]), IsPlaced: true },
    )).toBe('received')
  })

  it('preserves the selected packing list when an action reloads its invoice', () => {
    const draft = packingList('draft', [false])
    const carriedOut = { ...packingList('carried-out', [false]), IsPlaced: true }

    expect(selectIncomePackingList(invoice([draft, carriedOut]), 'carried-out')).toBe(carriedOut)
  })

  it('does not subtract applied placements twice when calculating editable capacity', () => {
    const rows = new Map([
      ['current', {
        Qty: 6,
        DynamicProductPlacements: [
          { Qty: 4, IsApplied: true },
          { Qty: 2, IsApplied: false },
        ],
      }],
      ['other', {
        Qty: 1,
        DynamicProductPlacements: [{ Qty: 1, IsApplied: false }],
      }],
    ])

    expect(getPlacementRowCapacity(10, 4, rows, 'current')).toBe(9)
  })

  it('keeps the submitted quantity when the row endpoint returns a stale zero', () => {
    const payload = {
      Qty: 10,
      PackingListPackageOrderItemId: 7,
      DynamicProductPlacements: [{ Qty: 10, IsApplied: false }],
    }
    const saved = {
      Id: 99,
      Qty: 0,
      PackingListPackageOrderItemId: 7,
      DynamicProductPlacements: [],
    }

    expect(mergeSavedPlacementRow(payload, saved)).toMatchObject({
      Id: 99,
      Qty: 10,
      PackingListPackageOrderItemId: 7,
      DynamicProductPlacements: [{ Qty: 10, IsApplied: false }],
    })
  })
})
