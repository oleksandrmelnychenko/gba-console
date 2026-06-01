import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ProductStorageAvailableConsignment,
  ProductStorageAvailabilitiesResponse,
  ProductStorageAvailability,
  ProductStoragePlacement,
  ProductStorageStorage,
  ProductStorageSupplyReturnPayload,
  ProductStorageTransferPayload,
  ProductStorageWriteOffPayload,
  ProductStoragesExportDocument,
  ProductStoragesSearchParams,
} from '../types'

export async function getProductStorageStorages(): Promise<ProductStorageStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all')

  return normalizeStorages(result)
}

export async function getAvailableProductsByStorage(
  params: ProductStoragesSearchParams,
): Promise<ProductStorageAvailabilitiesResponse> {
  const result = await apiRequest<unknown>('/storages/all/available/filtered', {
    query: {
      from: params.from || '',
      limit: params.limit,
      netId: params.storageNetId,
      offset: params.offset,
      to: params.to || '',
      value: params.value?.trim() || '',
    },
  })

  return normalizeAvailabilitiesResponse(result)
}

export async function exportProductStorageAvailability(params: {
  from?: string
  storageNetId: string
  to?: string
}): Promise<ProductStoragesExportDocument> {
  const result = await apiRequest<unknown>('/storages/document/export', {
    query: {
      from: params.from || '',
      netId: params.storageNetId,
      to: params.to || '',
    },
  })

  return normalizeExportDocument(result)
}

export async function createProductStorageTransfer(payload: ProductStorageTransferPayload): Promise<void> {
  await apiRequest<unknown>('/products/transfers/new', {
    method: 'POST',
    query: {
      storageNumber: payload.storageNumber || '',
      rowNumber: payload.rowNumber || '',
      cellNumber: payload.cellNumber || '',
    },
    body: payload.productTransfer,
  })
}

export async function createProductStorageWriteOff(payload: ProductStorageWriteOffPayload): Promise<unknown> {
  return apiRequest<unknown>('/orders/depreciated/new', {
    method: 'POST',
    body: payload,
  })
}

export async function recordProductStorageWriteOffHistory(depreciatedOrder: unknown): Promise<void> {
  await apiRequest<unknown>('/history/order/item/orders/depreciated/new', {
    method: 'POST',
    body: depreciatedOrder,
  })
}

export async function getProductStorageAvailableConsignments(params: {
  productNetId: string
  storageNetId: string
}): Promise<ProductStorageAvailableConsignment[]> {
  const result = await apiRequest<unknown>('/consignments/remaining/get/available', {
    query: params,
  })

  return readArrayPayload(result, ['Items', 'Consignments', 'Data']) as ProductStorageAvailableConsignment[]
}

export async function createProductStorageSupplyReturn(payload: ProductStorageSupplyReturnPayload): Promise<void> {
  await apiRequest<unknown>('/supplies/returns/new', {
    method: 'POST',
    body: payload,
  })
}

function normalizeStorages(result: unknown): ProductStorageStorage[] {
  if (Array.isArray(result)) {
    return result as ProductStorageStorage[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as ProductStorageStorage[]
  }

  if (Array.isArray(payload.Storages)) {
    return payload.Storages as ProductStorageStorage[]
  }

  return []
}

function normalizeAvailabilitiesResponse(result: unknown): ProductStorageAvailabilitiesResponse {
  const items = readArrayPayload(result, ['Items', 'Availabilities', 'ProductAvailabilities', 'Data'])
    .map((item) => normalizeAvailability(item as ProductStorageAvailability))
  const payload = result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : {}
  const totalQty =
    readNumber(payload.TotalRowsQty) ??
    readNumber(payload.TotalQty) ??
    readNumber(payload.Total) ??
    readNumber(payload.Count) ??
    readNumber(items[0]?.TotalRowsQty) ??
    items.length

  return { items, totalQty }
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

function normalizeAvailability(availability: ProductStorageAvailability): ProductStorageAvailability {
  const productPlacements = normalizePlacements(availability.Product?.ProductPlacements)

  return {
    ...availability,
    Placements: normalizePlacements(availability.Placements),
    Product: availability.Product
      ? {
          ...availability.Product,
          ProductPlacements: productPlacements,
        }
      : availability.Product,
  }
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return null
}

function normalizePlacements(placements: ProductStoragePlacement[] | undefined): ProductStoragePlacement[] {
  return Array.isArray(placements) ? placements : []
}

function normalizeExportDocument(result: unknown): ProductStoragesExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}
