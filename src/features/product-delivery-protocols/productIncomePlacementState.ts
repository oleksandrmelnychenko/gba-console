import type { IncomePackingList, IncomeSupplyInvoice } from './productIncomeTypes'

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
