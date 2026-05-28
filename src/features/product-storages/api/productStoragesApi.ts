import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ProductStorageAvailability,
  ProductStoragePlacement,
  ProductStorageStorage,
  ProductStoragesExportDocument,
  ProductStoragesSearchParams,
} from '../types'

export async function getProductStorageStorages(): Promise<ProductStorageStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all')

  return normalizeStorages(result)
}

export async function getAvailableProductsByStorage(
  params: ProductStoragesSearchParams,
): Promise<ProductStorageAvailability[]> {
  const result = await apiRequest<unknown>('/storages/all/available/filtered', {
    query: {
      limit: params.limit,
      netId: params.storageNetId,
      offset: params.offset,
      value: params.value?.trim() || '',
    },
  })

  return normalizeAvailabilities(result)
}

export async function exportProductStorageAvailability(
  storageNetId: string,
): Promise<ProductStoragesExportDocument> {
  const result = await apiRequest<unknown>('/storages/document/export', {
    query: {
      netId: storageNetId,
    },
  })

  return normalizeExportDocument(result)
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

function normalizeAvailabilities(result: unknown): ProductStorageAvailability[] {
  const items = readArrayPayload(result, ['Items', 'Availabilities', 'ProductAvailabilities', 'Data'])

  return items.map((item) => normalizeAvailability(item as ProductStorageAvailability))
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
