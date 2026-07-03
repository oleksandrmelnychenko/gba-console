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

export async function getProductStorageAvailableConsignments(params: {
  productNetId: string
  storageNetId: string
}): Promise<ProductStorageAvailableConsignment[]> {
  const result = await apiRequest<unknown>('/consignments/remaining/get/available', {
    query: params,
  })

  return readArrayPayload(result, ['Items', 'Consignments', 'Data']).map(normalizeAvailableConsignment)
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
    Amount: readNumber(availability.Amount) ?? undefined,
    ChangedQty: readNumber(availability.ChangedQty) ?? undefined,
    Placements: normalizePlacements(availability.Placements),
    Product: availability.Product
      ? {
          ...availability.Product,
          ProductPlacements: productPlacements,
        }
      : availability.Product,
    Qty: readNumber(availability.Qty) ?? undefined,
    TotalRowsQty: readNumber(availability.TotalRowsQty) ?? undefined,
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
  return Array.isArray(placements)
    ? placements.map((placement) => ({
        ...placement,
        Qty: readNumber(placement.Qty) ?? undefined,
      }))
    : []
}

function normalizeAvailableConsignment(result: unknown): ProductStorageAvailableConsignment {
  const consignment = (result && typeof result === 'object' ? result : {}) as ProductStorageAvailableConsignment

  return {
    ...consignment,
    ConsignmentItemId: readNumber(consignment.ConsignmentItemId) ?? undefined,
    RemainingQty: readNumber(consignment.RemainingQty) ?? undefined,
  }
}

function normalizeExportDocument(result: unknown): ProductStoragesExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL:
      readString(payload.DocumentURL)
      || readString(payload.XlsxDocument)
      || readString(payload.URL)
      || readString(payload.url),
    PdfDocumentURL: readString(payload.PdfDocumentURL) || readString(payload.PdfDocument),
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
