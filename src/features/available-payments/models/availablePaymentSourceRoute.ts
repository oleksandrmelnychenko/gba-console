import type { AvailablePaymentTaskModel } from '../types'

export function getAvailablePaymentSourceRoute(model: AvailablePaymentTaskModel): string | null {
  if (model.consumableOrderNetUid) {
    return `/accounting/consumable-orders/edit/${model.consumableOrderNetUid}`
  }

  if (model.supplyOrderUkraineNetUid) {
    return `/orders/ukraine/view/${model.supplyOrderUkraineNetUid}`
  }

  if (model.deliveryProductProtocolNetUid) {
    return `/product-delivery-protocols/${model.deliveryProductProtocolNetUid}`
  }

  return null
}
