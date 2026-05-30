import { apiRequest } from '../../../shared/api/apiClient'
import type { Sale, SalesResponse, WarehouseUkraineExportDocument } from '../types'

const PACKAGING_STATUS = 'Packaging'
const QUERY_TYPE_ALL = 'All'

export type SalesSearchParams = {
  from: string
  to: string
  value: string
  limit: number
  offset: number
}

export async function getWarehouseUkraineSales(params: SalesSearchParams): Promise<SalesResponse> {
  const result = await apiRequest<unknown>('/sales/all/filtered', {
    query: {
      status: PACKAGING_STATUS,
      type: QUERY_TYPE_ALL,
      value: params.value.trim(),
      from: params.from,
      to: params.to,
      fromShipments: true,
      limit: params.limit,
      offset: params.offset,
      forEcommerce: false,
    },
  })

  return normalizeSalesResponse(result)
}

export async function getSalePrintDocument(saleNetId: string): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/sales/get/document', {
    query: {
      netId: saleNetId,
      isFromStorages: true,
    },
  })

  return normalizeExportDocument(result)
}

export async function getSaleActProtocolEditDocument(
  saleNetId: string,
  isPrintedActProtocolEdit: boolean,
): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/sales/get/shifted/document', {
    query: {
      netId: saleNetId,
      IsPrintedActProtocolEdit: isPrintedActProtocolEdit,
    },
  })

  return normalizeExportDocument(result)
}

function normalizeSalesResponse(result: unknown): SalesResponse {
  const items = readArrayPayload(result, ['Items', 'Sales', 'Data']) as Sale[]
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const totalQty =
    readNumber(payload.TotalRowsQty) ??
    readNumber(payload.Total) ??
    readNumber(items[0]?.TotalRowsQty) ??
    items.length

  return { items, totalQty }
}

export function normalizeExportDocument(result: unknown): WarehouseUkraineExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

export function readArrayPayload(result: unknown, keys: string[]): unknown[] {
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

export function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return undefined
}
