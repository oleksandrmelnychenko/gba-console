import { apiRequest } from '../../../shared/api/apiClient'
import type {
  SupplyReturn,
  SupplyReturnExportDocument,
  SupplyReturnsResponse,
  SupplyReturnsSearchParams,
} from '../types'

export async function getSupplyReturns(params: SupplyReturnsSearchParams): Promise<SupplyReturnsResponse> {
  const result = await apiRequest<unknown>('/supplies/returns/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  return normalizeSupplyReturnsResponse(result)
}

export async function getSupplyReturnByNetId(netId: string): Promise<SupplyReturn | null> {
  const result = await apiRequest<unknown>('/supplies/returns/get', {
    query: {
      netId,
    },
  })

  return normalizeSupplyReturn(result)
}

export async function exportSupplyReturnDocument(netId: string): Promise<SupplyReturnExportDocument> {
  const result = await apiRequest<unknown>('/supplies/returns/document/export', {
    query: {
      netId,
    },
  })

  return normalizeExportDocument(result)
}

function normalizeSupplyReturnsResponse(result: unknown): SupplyReturnsResponse {
  const items = normalizeSupplyReturns(result)
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

function normalizeSupplyReturns(result: unknown): SupplyReturn[] {
  if (Array.isArray(result)) {
    return result.map(ensureSupplyReturn)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.SupplyReturns)
      ? payload.SupplyReturns
      : Array.isArray(payload.Data)
        ? payload.Data
        : []

  return (items as SupplyReturn[]).map(ensureSupplyReturn)
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

function normalizeSupplyReturn(result: unknown): SupplyReturn | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensureSupplyReturn(result as SupplyReturn)
}

function normalizeExportDocument(result: unknown): SupplyReturnExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function ensureSupplyReturn(supplyReturn: SupplyReturn): SupplyReturn {
  return {
    ...supplyReturn,
    SupplyReturnItems: Array.isArray(supplyReturn.SupplyReturnItems) ? supplyReturn.SupplyReturnItems : [],
  }
}
