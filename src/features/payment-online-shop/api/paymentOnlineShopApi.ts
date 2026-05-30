import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AddPaymentImagePayload,
  EditPaymentImagePayload,
  PaymentShopFilters,
  PaymentShopItem,
} from '../types'

export async function getPaymentShopItems(filters: PaymentShopFilters): Promise<PaymentShopItem[]> {
  const result = await apiRequest<unknown>('/sales/payment/images/get/filtered', {
    query: {
      saleDateFrom: filters.saleDateFrom ? new Date(filters.saleDateFrom).toISOString() : '',
      saleDateTo: filters.saleDateTo ? new Date(filters.saleDateTo).toISOString() : '',
      saleNumber: filters.saleNumber,
      phoneNumber: filters.phoneNumber,
    },
  })

  return normalizePaymentShopItems(result)
}

export async function addPaymentImage(payload: AddPaymentImagePayload): Promise<void> {
  const formData = new FormData()
  formData.append(
    'paymentImageItem',
    JSON.stringify({
      RetailClientPaymentImageId: payload.paymentImageId,
      Amount: payload.amount,
      User: payload.user,
      PaymentType: payload.paymentType,
      Comment: payload.comment,
    }),
  )
  formData.append('image', payload.image)

  await apiRequest<unknown>('/retail/clients/new/payment/item', {
    method: 'POST',
    body: formData,
  })
}

export async function editPaymentImage(payload: EditPaymentImagePayload): Promise<void> {
  await apiRequest<unknown>('/retail/clients/update/payment/item', {
    method: 'POST',
    body: {
      ...payload.item,
      RetailClientPaymentImageId: payload.paymentImageId,
      Amount: payload.amount,
      User: payload.user,
      Comment: payload.comment,
      PaymentType: 0,
    },
  })
}

function normalizePaymentShopItems(result: unknown): PaymentShopItem[] {
  if (Array.isArray(result)) {
    return result as PaymentShopItem[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.Data)
      ? payload.Data
      : Array.isArray(payload.Collection)
        ? payload.Collection
        : []

  return items as PaymentShopItem[]
}
