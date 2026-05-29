import { apiRequest } from '../../../shared/api/apiClient'
import type {
  SupplyReturn,
  SupplyReturnExportDocument,
  SupplyReturnsSearchParams,
} from '../types'

export async function getSupplyReturns(params: SupplyReturnsSearchParams): Promise<SupplyReturn[]> {
  const result = await apiRequest<unknown>('/supplies/returns/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  return normalizeSupplyReturns(result)
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
