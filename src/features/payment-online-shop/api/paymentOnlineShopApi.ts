import { apiRequest } from '../../../shared/api/apiClient'
import { formatDateInputForQuery } from '../../../shared/date/dateTime'
import type {
  AddPaymentImagePayload,
  EditPaymentImagePayload,
  PaymentShopFilters,
  PaymentShopItem,
  PaymentShopItemsResponse,
} from '../types'

export async function getPaymentShopItems(filters: PaymentShopFilters): Promise<PaymentShopItem[]> {
  const response = await getPaymentShopItemsPage(filters)

  return response.items
}

export async function getPaymentShopItemsPage(filters: PaymentShopFilters): Promise<PaymentShopItemsResponse> {
  const result = await apiRequest<unknown>('/sales/payment/images/get/filtered', {
    query: {
      saleDateFrom: formatDateInputForQuery(filters.saleDateFrom),
      saleDateTo: formatDateInputForQuery(filters.saleDateTo),
      saleNumber: filters.saleNumber,
      phoneNumber: filters.phoneNumber,
      limit: filters.limit ?? 100,
      offset: filters.offset ?? 0,
    },
  })

  return normalizePaymentShopItemsResponse(result)
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

export async function editPaymentImage(payload: EditPaymentImagePayload): Promise<PaymentShopItem | null> {
  const result = await apiRequest<unknown>('/retail/clients/update/payment/item', {
    method: 'POST',
    body: {
      ...payload.item,
      RetailClientPaymentImageId: payload.paymentImageId,
      Amount: payload.amount,
      User: payload.user,
      Comment: payload.comment,
    },
  })

  return normalizePaymentShopItem(result)
}

function normalizePaymentShopItemsResponse(result: unknown): PaymentShopItemsResponse {
  if (Array.isArray(result)) {
    return { items: result as PaymentShopItem[] }
  }

  if (!result || typeof result !== 'object') {
    return { items: [] }
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.Data)
      ? payload.Data
      : Array.isArray(payload.Collection)
        ? payload.Collection
        : []

  return {
    items: items as PaymentShopItem[],
    totalRowsQty:
      readOptionalNumber(payload.TotalRowsQty)
      ?? readOptionalNumber(payload.TotalQty)
      ?? readOptionalNumber(payload.Total)
      ?? readOptionalNumber((items[0] as Record<string, unknown> | undefined)?.TotalRowsQty)
      ?? readOptionalNumber((items[0] as Record<string, unknown> | undefined)?.TotalQty),
  }
}

function normalizePaymentShopItem(result: unknown): PaymentShopItem | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Record<string, unknown>
  const item = payload.Entity || payload.PaymentShopItem || payload.Data || result

  return item && typeof item === 'object' ? (item as PaymentShopItem) : null
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}
