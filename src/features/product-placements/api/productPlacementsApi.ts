import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ProductPlacementReturnPayload,
  ProductPlacementsExportDocument,
  ProductPlacementsResponse,
  ProductPlacementsSearchParams,
  ProductPlacementRow,
  ProductPlacementStorageLocation,
  ProductPlacementUploadResult,
} from '../types'

export async function getProductPlacementStorages(): Promise<ProductPlacementStorageLocation[]> {
  const result = await apiRequest<unknown>('/storages/all/nondefective')

  return normalizeStorages(result)
}

export async function getProductPlacements(params: ProductPlacementsSearchParams): Promise<ProductPlacementsResponse> {
  const result = await apiRequest<unknown>('/products/placements/storage/all/filtered', {
    query: {
      limit: params.limit,
      offset: params.offset,
      storageId: params.storageIds,
      to: params.to,
      value: params.value?.trim() || '',
    },
  })

  return normalizePlacementsResponse(result)
}

export async function exportProductPlacements(): Promise<ProductPlacementsExportDocument> {
  const result = await apiRequest<unknown>('/products/placements/storage/document/create/export')

  return normalizeExportDocument(result)
}

export async function exportReturnedProductPlacements(
  rows: ProductPlacementRow[],
): Promise<ProductPlacementsExportDocument> {
  const result = await apiRequest<unknown>('/products/placements/storage/document/create/import', {
    body: rows,
    method: 'POST',
  })

  return normalizeExportDocument(result)
}

export async function uploadProductPlacementFile(formData: FormData): Promise<ProductPlacementUploadResult> {
  const result = await apiRequest<unknown>('/products/placements/storage/upload/placement/file', {
    body: formData,
    method: 'POST',
  })

  return {
    ReturnedProducts: normalizePlacements(result),
  }
}

export async function submitReturnedProductPlacements(
  payload: ProductPlacementReturnPayload,
): Promise<ProductPlacementUploadResult> {
  const result = await apiRequest<unknown>('/products/placements/storage/upload/placement/return', {
    body: payload,
    method: 'POST',
  })

  return {
    ReturnedProducts: normalizePlacements(result),
  }
}

function normalizeStorages(result: unknown): ProductPlacementStorageLocation[] {
  return readArrayPayload(result, ['Items', 'Storages', 'Data']) as ProductPlacementStorageLocation[]
}

function normalizePlacementsResponse(result: unknown): ProductPlacementsResponse {
  const items = normalizePlacements(result)
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const total = readNumber(payload.Total, readNumber(payload.TotalRowQty, readNumber(payload.TotalRowsQty)))
    ?? readNumber(items[0]?.TotalRowQty, readNumber(items[0]?.TotalRowsQty))

  return {
    Items: items,
    Total: total,
  }
}

function normalizePlacements(result: unknown): ProductPlacementRow[] {
  return readArrayPayload(result, ['Items', 'ProductPlacementStorage', 'ProductPlacements', 'ReturnedProducts', 'Data'])
    .map((item) => normalizePlacement(item as ProductPlacementRow))
}

function normalizePlacement(row: ProductPlacementRow): ProductPlacementRow {
  return {
    ...row,
    Product: row.Product || null,
    Storage: row.Storage || null,
  }
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

function normalizeExportDocument(result: unknown): ProductPlacementsExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL:
      typeof payload.PdfDocumentURL === 'string'
        ? payload.PdfDocumentURL
        : typeof payload.PdfDocument === 'string'
          ? payload.PdfDocument
          : '',
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
