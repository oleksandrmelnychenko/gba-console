import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ConsignmentAvailabilityItem,
  ProductAvailabilityExportDocument,
  ProductAvailabilitiesResponse,
  ProductAvailabilitiesSearchParams,
  Storage,
} from '../types'

export async function getProductAvailabilities(
  params: ProductAvailabilitiesSearchParams,
): Promise<ProductAvailabilitiesResponse> {
  const result = await apiRequest<unknown>('/consignments/info/availability/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      storageNetId: params.storageNetId,
      to: params.to,
      vendorCode: params.vendorCode?.trim() || '',
    },
  })

  return normalizeProductAvailabilitiesResponse(result)
}

export async function getProductAvailabilityStorages(): Promise<Storage[]> {
  const result = await apiRequest<unknown>('/storages/get/all')

  return normalizeStorages(result)
}

export async function exportProductAvailabilities(
  params: Pick<ProductAvailabilitiesSearchParams, 'from' | 'storageNetId' | 'to' | 'vendorCode'>,
): Promise<ProductAvailabilityExportDocument> {
  const result = await apiRequest<unknown>('/consignments/info/availability/filtered/export', {
    query: {
      from: params.from,
      storageNetId: params.storageNetId,
      to: params.to,
      vendorCode: params.vendorCode?.trim() || '',
    },
  })

  return normalizeExportDocument(result)
}

function normalizeProductAvailabilitiesResponse(result: unknown): ProductAvailabilitiesResponse {
  if (!result || typeof result !== 'object') {
    return {
      Availabilities: [],
      Total: 0,
    }
  }

  const payload = result as Record<string, unknown>
  const availabilities = Array.isArray(payload.Availabilities)
    ? (payload.Availabilities as ConsignmentAvailabilityItem[])
    : Array.isArray(payload.Items)
      ? (payload.Items as ConsignmentAvailabilityItem[])
      : []

  return {
    Availabilities: availabilities.map(ensureConsignmentAvailabilityItem),
    Total: readNumber(payload.Total, availabilities.length),
  }
}

function normalizeStorages(result: unknown): Storage[] {
  if (Array.isArray(result)) {
    return result as Storage[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as Storage[]
  }

  if (Array.isArray(payload.Storages)) {
    return payload.Storages as Storage[]
  }

  return []
}

function normalizeExportDocument(result: unknown): ProductAvailabilityExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function ensureConsignmentAvailabilityItem(
  availability: ConsignmentAvailabilityItem,
): ConsignmentAvailabilityItem {
  return {
    ...availability,
    Placements: Array.isArray(availability.Placements) ? availability.Placements : [],
  }
}

function readNumber(value: unknown, fallback: number): number {
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
