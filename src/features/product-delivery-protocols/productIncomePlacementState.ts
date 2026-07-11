import type {
  DynamicProductPlacementColumn,
  IncomePackingList,
  IncomeSupplyInvoice,
} from './productIncomeTypes'

export type ProductIncomePlacementState = 'draft' | 'partially-received' | 'received'

export function createIncomeDynamicPlacementColumn(
  packingList: IncomePackingList,
  fromDate: string,
): DynamicProductPlacementColumn {
  return {
    FromDate: fromDate,
    PackingListId: packingList.Id,
    DynamicProductPlacementRows: packingList.PackingListPackageOrderItems.map((item) => ({
      Qty: 0,
      PackingListPackageOrderItemId: item.Id,
      PackingListPackageOrderItem: item,
      DynamicProductPlacements: [],
    })),
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
