import { apiRequest } from '../../../shared/api/apiClient'
import { buildServerSearchFilter } from '../../../shared/api/searchQuery'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import type {
  CreateDirectSalesReturnPayload,
  CreateSalesReturnPayload,
  SalesForReturnSearchParams,
  SalesReturn,
  SalesReturnBatch,
  SalesReturnClient,
  SalesReturnDocument,
  SalesReturnItemStatusValue,
  SalesReturnOrganization,
  SalesReturnProduct,
  SalesReturnsSearchParams,
  SalesReturnSale,
  SalesReturnStorage,
} from '../types'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const CLIENT_SEARCH_LIMIT = 20
const CLIENT_FILTER_ENTITY_TYPE_CLIENT = 0
const CLIENT_SEARCH_SQL = 'RegionCode.Value/Client.FullName/Client.USREOU'

export async function getSaleReturns(params: SalesReturnsSearchParams): Promise<SalesReturn[]> {
  const result = await apiRequest<unknown>('/sales/returns/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
      value: params.value?.trim() || '',
    },
  })

  return readArrayPayload(result, ['Items', 'SaleReturns', 'Returns', 'Data']) as SalesReturn[]
}

export async function exportSaleReturnDocument(netId: string): Promise<SalesReturnDocument> {
  const result = await apiRequest<unknown>('/sales/returns/documents/export/get', {
    query: {
      netId,
    },
  })

  return normalizeDocument(result)
}

export async function exportSaleReturnsReport(params: {
  clientNetId?: string
  forMyClients: boolean
  from: string
  reportType: 0 | 1
  to: string
}): Promise<SalesReturnDocument> {
  const result = await apiRequest<unknown>('/sales/returns/document/export', {
    query: {
      ...params,
      from: toDateTimeQuery(params.from, 'start'),
      to: toDateTimeQuery(params.to, 'end'),
    },
  })

  return normalizeDocument(result)
}

export async function cancelSaleReturn(netId: string): Promise<SalesReturn | null> {
  const result = await apiRequest<unknown>('/sales/returns/cancel', {
    method: 'PUT',
    query: {
      netId,
    },
  })

  return normalizeSaleReturn(result)
}

export async function createSaleReturn(payload: CreateSalesReturnPayload): Promise<SalesReturn | null> {
  const result = await apiRequest<unknown>('/sales/returns/new', {
    body: payload,
    method: 'POST',
  })

  return normalizeSaleReturn(result)
}

export async function createDirectSaleReturn(payload: CreateDirectSalesReturnPayload): Promise<SalesReturn | null> {
  const result = await apiRequest<unknown>('/sales/returns/new', {
    body: payload,
    method: 'POST',
  })

  return normalizeSaleReturn(result)
}

export async function getSalesForReturn(params: SalesForReturnSearchParams): Promise<SalesReturnSale[]> {
  const result = await apiRequest<unknown>('/sales/all/returns/search', {
    query: {
      from: params.from,
      netId: params.clientNetId || '',
      organizationNetId: params.organizationNetId || '',
      to: params.to,
      value: params.value?.trim() || '',
    },
  })

  return readArrayPayload(result, ['Items', 'Sales', 'Data']) as SalesReturnSale[]
}

export async function searchSalesReturnClients(value: string, signal?: AbortSignal): Promise<SalesReturnClient[]> {
  const result = await apiRequest<unknown>('/search/by/query', {
    query: {
      filter: buildClientSearchFilter(value),
    },
    ...(signal ? { signal } : {}),
  })

  return readArrayPayload(result, ['Items', 'Clients', 'Data']) as SalesReturnClient[]
}

export async function getSalesReturnOrganizations(): Promise<SalesReturnOrganization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readArrayPayload(result, ['Items', 'Organizations', 'Data']) as SalesReturnOrganization[]
}

export async function getStoragesByOrganization(
  organizationNetId: string,
  skipDefective = false,
): Promise<SalesReturnStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all/filtered', {
    query: {
      organizationNetId,
      skipDefective,
    },
  })

  return readArrayPayload(result, ['Items', 'Storages', 'Data']) as SalesReturnStorage[]
}

export async function getReturnStorages(params: {
  orderItemNetId: string
  organizationNetId: string
  status?: SalesReturnItemStatusValue
}): Promise<SalesReturnStorage[]> {
  const result = await apiRequest<unknown>('/storages/all/returns/filtered', {
    query: {
      orderItemNetId: params.orderItemNetId,
      organizationNetId: params.organizationNetId,
      status: params.status,
    },
  })

  return readArrayPayload(result, ['Items', 'Storages', 'Data']) as SalesReturnStorage[]
}

export async function getReturnVatWarning(orderItemNetId: string): Promise<string> {
  const result = await apiRequest<unknown>('/sales/returns/vat', {
    query: {
      netId: orderItemNetId,
    },
  })

  if (typeof result === 'string') {
    return result
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>
    const message = payload.Message ?? payload.Value ?? payload.Text

    return typeof message === 'string' ? message : ''
  }

  return ''
}

export async function searchReturnProducts(value: string): Promise<SalesReturnProduct[]> {
  const normalizedValue = value.trim()

  if (normalizedValue.length < 4) {
    return []
  }

  const result = await apiRequest<unknown>('/products/search/advanced', {
    query: {
      limit: 10,
      mode: 0,
      netId: EMPTY_GUID,
      offset: 0,
      sortMode: 0,
      value: normalizedValue,
    },
  })

  return readArrayPayload(result, ['Items', 'Products', 'Data']) as SalesReturnProduct[]
}

export async function getReturnProductByNetId(netId: string): Promise<SalesReturnProduct | null> {
  const result = await apiRequest<unknown>('/products/get', {
    query: {
      netId,
    },
  })

  return normalizeProduct(result)
}

export async function getIncomeConsignments(params: {
  from: string
  productNetId: string
  to: string
}): Promise<SalesReturnBatch[]> {
  const result = await apiRequest<unknown>('/consignments/info/income/filtered', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
  })

  return readArrayPayload(result, ['Items', 'Consignments', 'Data']) as SalesReturnBatch[]
}

function normalizeDocument(result: unknown): SalesReturnDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: readString(payload.DocumentURL),
    PdfDocumentURL: readString(payload.PdfDocumentURL),
    XlsxDocument: readString(payload.XlsxDocument),
    PdfDocument: readString(payload.PdfDocument),
  }
}

function normalizeSaleReturn(result: unknown): SalesReturn | null {
  if (result && typeof result === 'object') {
    return result as SalesReturn
  }

  return null
}

function normalizeProduct(result: unknown): SalesReturnProduct | null {
  if (result && typeof result === 'object') {
    return result as SalesReturnProduct
  }

  return null
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

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function buildClientSearchFilter(value: string): string {
  return buildServerSearchFilter({
    filterEntityType: CLIENT_FILTER_ENTITY_TYPE_CLIENT,
    filterSql: CLIENT_SEARCH_SQL,
    limit: CLIENT_SEARCH_LIMIT,
    offset: 0,
    table: 'Client',
    value: value.trim(),
  })
}
