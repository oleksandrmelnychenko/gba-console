import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ProductAvailabilityDataHistory,
  ProductHistoryExportDocument,
  ProductHistoryItem,
  ProductHistoryResponse,
  ProductHistorySearchParams,
  ProductHistoryStorage,
} from '../types'

export async function getProductHistoryStorages(): Promise<ProductHistoryStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all')

  return normalizeStorages(result)
}

export async function getProductHistory(params: ProductHistorySearchParams): Promise<ProductHistoryResponse> {
  const result = await apiRequest<unknown>('/history/order/item/get', {
    query: {
      limit: params.limit,
      offset: params.offset,
      storageId: params.storageIds,
      to: params.to,
      value: params.value?.trim() || '',
    },
  })

  return normalizeHistoryResponse(result)
}

export async function exportProductHistory(
  params: ProductHistorySearchParams,
): Promise<ProductHistoryExportDocument> {
  const result = await apiRequest<unknown>('/history/order/item/document/create/export', {
    query: {
      limit: params.limit,
      offset: params.offset,
      storageId: params.storageIds,
      to: params.to,
      value: params.value?.trim() || '',
    },
  })

  return normalizeExportDocument(result)
}

function normalizeStorages(result: unknown): ProductHistoryStorage[] {
  if (Array.isArray(result)) {
    return result as ProductHistoryStorage[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as ProductHistoryStorage[]
  }

  if (Array.isArray(payload.Storages)) {
    return payload.Storages as ProductHistoryStorage[]
  }

  return []
}

function normalizeHistoryResponse(result: unknown): ProductHistoryResponse {
  const items = readArrayPayload(result, ['Items', 'ProductHistory', 'History', 'Data']).map((item) =>
    normalizeHistoryItem(item as ProductHistoryItem),
  )
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const total = readNumber(payload.Total, readNumber(payload.TotalRowQty, readNumber(payload.TotalRowsQty)))
    ?? readNumber(items[0]?.TotalRowQty, readNumber(items[0]?.TotalRowsQty))

  return {
    Items: items,
    Total: total,
  }
}

function normalizeHistoryItem(item: ProductHistoryItem): ProductHistoryItem {
  return {
    ...item,
    ProductAvailabilityDataHistory: normalizeAvailabilityHistory(item.ProductAvailabilityDataHistory),
  }
}

function normalizeAvailabilityHistory(
  availabilityHistory?: ProductAvailabilityDataHistory[],
): ProductAvailabilityDataHistory[] {
  if (!Array.isArray(availabilityHistory)) {
    return []
  }

  return availabilityHistory.map((availability) => ({
    ...availability,
    ProductPlacementDataHistory: Array.isArray(availability.ProductPlacementDataHistory)
      ? availability.ProductPlacementDataHistory
      : [],
  }))
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}

function normalizeExportDocument(result: unknown): ProductHistoryExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function readNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return fallback
}
