import { apiRequest } from '../../../shared/api/apiClient'
import type {
  TaxFreeCarrier,
  TaxFreeCarrierExportColumn,
  TaxFreeCarrierExportDocument,
  TaxFreeCarrierPayload,
} from '../types'

export async function getTaxFreeCarriers(): Promise<TaxFreeCarrier[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/all')

  return normalizeCarriers(result)
}

export async function searchTaxFreeCarriers(value: string): Promise<TaxFreeCarrier[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/all/search', {
    query: { value },
  })

  return normalizeCarriers(result)
}

export async function getTaxFreeCarrier(netId: string): Promise<TaxFreeCarrier | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/get', {
    query: { netId },
  })

  return normalizeCarrier(result)
}

export async function createTaxFreeCarrier(payload: TaxFreeCarrierPayload): Promise<TaxFreeCarrier | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/new', {
    body: payload,
    method: 'POST',
  })

  return normalizeCarrier(result)
}

export async function updateTaxFreeCarrier(payload: TaxFreeCarrierPayload): Promise<TaxFreeCarrier | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/update', {
    body: payload,
    method: 'POST',
  })

  return normalizeCarrier(result)
}

export async function deleteTaxFreeCarrier(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/ukraine/carriers/statham/delete', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function exportTaxFreeCarriersDocument(
  columns: TaxFreeCarrierExportColumn[],
): Promise<TaxFreeCarrierExportDocument> {
  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/print/documents', {
    body: columns,
    method: 'POST',
  })

  return normalizeExportDocument(result)
}

function normalizeCarriers(result: unknown): TaxFreeCarrier[] {
  if (Array.isArray(result)) {
    return result.map(ensureCarrier)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.Stathams)
      ? payload.Stathams
      : Array.isArray(payload.Collection)
        ? payload.Collection
        : []

  return (items as TaxFreeCarrier[]).map(ensureCarrier)
}

function normalizeCarrier(result: unknown): TaxFreeCarrier | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensureCarrier(result as TaxFreeCarrier)
}

function normalizeExportDocument(result: unknown): TaxFreeCarrierExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function ensureCarrier(carrier: TaxFreeCarrier): TaxFreeCarrier {
  return {
    ...carrier,
    StathamCars: Array.isArray(carrier.StathamCars) ? carrier.StathamCars : [],
    StathamPassports: Array.isArray(carrier.StathamPassports) ? carrier.StathamPassports : [],
  }
}
