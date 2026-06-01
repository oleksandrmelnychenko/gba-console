import type { ProductIncomeDocument } from './types'

const ACT_RECONCILIATION_PATH = '/ukraine/act/reconcoliation'

export function getProductIncomeDocumentSourceLink(document: ProductIncomeDocument): string | null {
  const items = document.ProductIncomeItems || []
  const firstItem = items[0]

  if (!firstItem) {
    return null
  }

  const actReconciliationNetUid = items.find((item) => item.ActReconciliationItem?.ActReconciliation?.NetUid)
    ?.ActReconciliationItem?.ActReconciliation?.NetUid

  if (actReconciliationNetUid) {
    return `${ACT_RECONCILIATION_PATH}/${actReconciliationNetUid}`
  }

  if (!document.NetUid) {
    return null
  }

  if (firstItem.PackingListPackageOrderItem) {
    return `/supply-orders/product-placement/${document.NetUid}`
  }

  if (firstItem.SupplyOrderUkraineItem) {
    return `/orders/ukraine/${document.NetUid}/product-income`
  }

  if (firstItem.ProductCapitalizationItem?.ProductCapitalization?.NetUid) {
    return '/products/capitalization'
  }

  if (items.some((item) => item.SaleReturnItem !== null && typeof item.SaleReturnItem !== 'undefined')) {
    return '/sales/return/client'
  }

  return null
}
