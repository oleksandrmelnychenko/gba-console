import { apiRequest } from '../../../shared/api/apiClient'
import type {
  Client,
  ClientAgreement,
  Organization,
  Statham,
  SupplyOrderFromPackListPayload,
  TaxFree,
  TaxFreePackList,
  TaxFreePackListsResponse,
  TaxFreePackListsSearchParams,
  TaxFreePrintDocument,
} from '../types'
import { normalizePackList, normalizeTaxFree } from '../utils'

export async function getTaxFreePackLists(params: TaxFreePackListsSearchParams): Promise<TaxFreePackListsResponse> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  const items = readList<TaxFreePackList>(result).map(normalizePackList)

  return {
    items,
    totalQty: readTotalQty(result, items),
  }
}

export async function getTaxFreePackListById(netId: string): Promise<TaxFreePackList | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/get', {
    query: {
      netId,
    },
  })

  return normalizeObject<TaxFreePackList>(result, normalizePackList)
}

async function updateTaxFreePackList(packList: TaxFreePackList): Promise<TaxFreePackList | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/update', {
    body: packList,
    method: 'POST',
  })

  return normalizeObject<TaxFreePackList>(result, normalizePackList)
}

async function updateSaleTaxFreePackList(packList: TaxFreePackList): Promise<TaxFreePackList | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/update/sale', {
    body: packList,
    method: 'POST',
  })

  return normalizeObject<TaxFreePackList>(result, normalizePackList)
}

export function saveTaxFreePackList(packList: TaxFreePackList): Promise<TaxFreePackList | null> {
  return packList.IsFromSale ? updateSaleTaxFreePackList(packList) : updateTaxFreePackList(packList)
}

export async function deleteTaxFreePackList(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function breakTaxFreePackList(packList: TaxFreePackList): Promise<TaxFreePackList | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/break', {
    body: packList,
    method: 'POST',
  })

  return normalizeObject<TaxFreePackList>(result, normalizePackList)
}

export async function updateTaxFree(taxFree: TaxFree): Promise<TaxFree | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/update', {
    body: taxFree,
    method: 'POST',
  })

  return normalizeObject<TaxFree>(result, normalizeTaxFree)
}

export async function getTaxFreePrintDocument(netId: string): Promise<TaxFreePrintDocument | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/documents/printing/get', {
    query: {
      netId,
    },
  })

  return normalizeObject<TaxFreePrintDocument>(result)
}

export async function getTaxFreePrintDocuments(netIds: string[]): Promise<TaxFreePrintDocument | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/documents/printing/get/all', {
    body: netIds,
    method: 'POST',
  })

  return normalizeObject<TaxFreePrintDocument>(result)
}

export async function uploadTaxFreeDocuments(netId: string, files: File[]): Promise<TaxFree | null> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/documents/upload', {
    body: formData,
    method: 'POST',
    query: {
      netId,
    },
  })

  return normalizeObject<TaxFree>(result, normalizeTaxFree)
}

export async function deleteTaxFreeDocument(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/ukraine/order/taxfree/documents/remove', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function exportTaxFreePackLists(params: {
  columns: unknown[]
  from: string
  to: string
}): Promise<TaxFreePrintDocument | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/taxfree/print/documents', {
    body: params.columns,
    method: 'POST',
    query: {
      from: params.from,
      to: params.to,
    },
  })

  return normalizeObject<TaxFreePrintDocument>(result)
}

export async function getOrganizations(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readList<Organization>(result)
}

export async function searchClients(value: string, signal?: AbortSignal): Promise<Client[]> {
  if (!value.trim()) {
    return []
  }

  const result = await apiRequest<unknown>('/clients/search/all', {
    query: {
      value: value.trim(),
    },
    ...(signal ? { signal } : {}),
  })

  return readList<Client>(result)
}

export async function getClientAgreements(netId: string): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: {
      netId,
    },
  })

  return readList<ClientAgreement>(result)
}

export async function searchCarriers(value: string, signal?: AbortSignal): Promise<Statham[]> {
  if (!value.trim()) {
    return []
  }

  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/all/search', {
    query: {
      value: value.trim(),
    },
    ...(signal ? { signal } : {}),
  })

  return readList<Statham>(result).map(normalizeCarrier)
}

export async function getCarrierById(netId: string): Promise<Statham | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/get', {
    query: {
      netId,
    },
  })

  return normalizeObject<Statham>(result, normalizeCarrier)
}

export async function getSupplierClients(): Promise<Client[]> {
  const result = await apiRequest<unknown>('/clients/all/manufacturers')

  return readList<Client>(result)
}

export async function createSupplyOrderFromPackList(
  packListNetId: string,
  payload: SupplyOrderFromPackListPayload,
): Promise<{ NetUid?: string } | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/new/packlist/taxfree', {
    body: payload,
    method: 'POST',
    query: {
      packListNetId,
    },
  })

  return normalizeObject<{ NetUid?: string }>(result)
}

function readList<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = payload.Items ?? payload.Data ?? payload.Collection ?? payload.Values

  return Array.isArray(items) ? (items as T[]) : []
}

function readTotalQty(result: unknown, items: TaxFreePackList[]): number | undefined {
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}

  return readNumber(payload.TotalQty)
    ?? readNumber(payload.Total)
    ?? readNumber(payload.TotalRowsQty)
    ?? readNumber(payload.TotalRowQty)
    ?? readNumber(items[0]?.TotalRowsQty)
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function normalizeObject<T>(result: unknown): T | null
function normalizeObject<T>(result: unknown, normalize: (value: T) => T): T | null
function normalizeObject<T>(result: unknown, normalize?: (value: T) => T): T | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const value = result as T

  return normalize ? normalize(value) : value
}

function normalizeCarrier(carrier: Statham): Statham {
  return {
    ...carrier,
    StathamPassports: Array.isArray(carrier.StathamPassports)
      ? carrier.StathamPassports.map((passport) => ({
          ...passport,
          PasportName: passport.PasportName || [passport.PassportSeria, passport.PassportNumber].filter(Boolean).join(' '),
        }))
      : [],
  }
}
