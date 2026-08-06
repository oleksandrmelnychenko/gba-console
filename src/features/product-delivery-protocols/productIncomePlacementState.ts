import type {
  DynamicProductPlacementRow,
  DynamicProductPlacementColumn,
  IncomePackingList,
  IncomeSupplyInvoice,
} from './productIncomeTypes'

function sumPlacementQty(row: DynamicProductPlacementRow, applied: boolean): number {
  const placements = row.DynamicProductPlacements || []

  if (!placements.length) {
    return applied ? 0 : row.Qty || 0
  }

  return placements.reduce(
    (total, placement) => total + (Boolean(placement.IsApplied) === applied ? placement.Qty || 0 : 0),
    0,
  )
}

export function getPlacementRowCapacity(
  itemQty: number,
  placedQty: number,
  rowsByColumn: Map<string, DynamicProductPlacementRow>,
  currentColumnId: string,
): number {
  const currentRow = rowsByColumn.get(currentColumnId)
  const currentAppliedQty = currentRow ? sumPlacementQty(currentRow, true) : 0
  const otherPendingQty = Array.from(rowsByColumn.entries()).reduce(
    (total, [columnId, row]) => total + (columnId === currentColumnId ? 0 : sumPlacementQty(row, false)),
    0,
  )

  return currentAppliedQty + Math.max(itemQty - placedQty - otherPendingQty, 0)
}

export function mergeSavedPlacementRow(
  payload: DynamicProductPlacementRow,
  savedRow: DynamicProductPlacementRow,
): DynamicProductPlacementRow {
  const savedPlacements = savedRow.DynamicProductPlacements || []
  const savedQty = savedPlacements.reduce((total, placement) => total + (placement.Qty || 0), 0)

  return {
    ...payload,
    ...savedRow,
    Qty: payload.Qty,
    PackingListPackageOrderItemId:
      savedRow.PackingListPackageOrderItemId || payload.PackingListPackageOrderItemId,
    PackingListPackageOrderItem:
      savedRow.PackingListPackageOrderItem || payload.PackingListPackageOrderItem,
    DynamicProductPlacements:
      savedPlacements.length > 0 && savedQty === payload.Qty
        ? savedPlacements
        : payload.DynamicProductPlacements,
  }
}

export type ProductIncomePlacementState = 'draft' | 'partially-received' | 'received'

export function createIncomeDynamicPlacementColumn(
  packingList: IncomePackingList,
  fromDate: string,
): DynamicProductPlacementColumn {
  return {
    FromDate: fromDate,
    PackingListId: packingList.Id,
    // A column is persisted independently from its rows. Keep the add-column
    // mutation small and canonical; the grid supplies an empty row for display
    // and the dedicated row endpoint creates it when a placement is entered.
    DynamicProductPlacementRows: [],
  }
}

/**
 * The specification view is intentionally flat and does not carry boxes,
 * pallets, documents, or other canonical packing-list children. Keep the
 * server-loaded aggregate intact and replace only the placement columns that
 * this screen owns.
 */
export function createPackingListPlacementMutationPayload(
  invoice: IncomeSupplyInvoice,
  editedPackingList: IncomePackingList,
): IncomeSupplyInvoice {
  const editedNetUid = editedPackingList.NetUid
  const editedId = editedPackingList.Id
  const matches = (candidate: IncomePackingList) =>
    Boolean(
      (editedNetUid && candidate.NetUid === editedNetUid)
      || (editedId && candidate.Id === editedId),
    )

  if (!invoice.PackingLists.some(matches)) {
    throw new Error('The edited packing list does not belong to the selected invoice')
  }

  return {
    ...invoice,
    PackingLists: invoice.PackingLists.map((candidate) =>
      matches(candidate)
        ? {
            ...candidate,
            DynamicProductPlacementColumns: editedPackingList.DynamicProductPlacementColumns,
          }
        : candidate,
    ),
  }
}

export function isInvoiceAllNotPlaced(
  invoice: IncomeSupplyInvoice | null,
  selectedPackingList?: IncomePackingList | null,
): boolean {
  if (!invoice || !invoice.PackingLists.length) {
    return false
  }

  return invoice.PackingLists.every((packingList) => {
    const list =
      selectedPackingList?.NetUid && selectedPackingList.NetUid === packingList.NetUid
        ? selectedPackingList
        : packingList
    const items = list.PackingListPackageOrderItems || []

    return items.every((item) => !item.IsPlaced)
  })
}

export function getProductIncomePlacementState(
  invoice: IncomeSupplyInvoice | null,
  packingList: IncomePackingList | null,
): ProductIncomePlacementState {
  if (packingList?.IsPlaced || invoice?.IsFullyPlaced) {
    return 'received'
  }

  const hasReceivedItems = (packingList?.PackingListPackageOrderItems || []).some(
    (item) => item.IsPlaced || (item.PlacedQty || 0) > 0,
  )

  if (invoice?.IsPartiallyPlaced || hasReceivedItems) {
    return 'partially-received'
  }

  return 'draft'
}

export function selectIncomePackingList(
  invoice: IncomeSupplyInvoice,
  currentPackingListNetUid: string | null,
): IncomePackingList | undefined {
  return invoice.PackingLists.find((packingList) => packingList.NetUid === currentPackingListNetUid)
    || invoice.PackingLists[0]
}
