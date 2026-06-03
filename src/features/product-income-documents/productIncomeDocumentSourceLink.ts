import type { ProductIncomeDocument } from './types'
import { getActiveProductIncomeItems } from './productIncomeDocumentItems'

const ACT_RECONCILIATION_PATH = '/ukraine/act/reconcoliation'

export function getProductIncomeDocumentSourceLink(document: ProductIncomeDocument): string | null {
  const items = getActiveProductIncomeItems(document)

  const actReconciliationNetUid = items.find((item) => item.ActReconciliationItem?.ActReconciliation?.NetUid)
    ?.ActReconciliationItem?.ActReconciliation?.NetUid

  if (actReconciliationNetUid) {
    return `${ACT_RECONCILIATION_PATH}/${actReconciliationNetUid}`
  }

  if (document.NetUid) {
    if (items.some((item) => item.PackingListPackageOrderItem)) {
      return `/supply-orders/product-placement/${document.NetUid}`
    }

    if (items.some((item) => item.SupplyOrderUkraineItem)) {
      return `/orders/ukraine/${document.NetUid}/product-income`
    }
  }

  const capitalizationNetUid = items.find((item) => item.ProductCapitalizationItem?.ProductCapitalization?.NetUid)
    ?.ProductCapitalizationItem?.ProductCapitalization?.NetUid

  if (capitalizationNetUid) {
    return `/products/capitalization?netId=${encodeURIComponent(capitalizationNetUid)}`
  }

  return null
}
