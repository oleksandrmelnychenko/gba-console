import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeExportDocument as normalizeSharedExportDocument } from '../../../shared/documents/exportDocument'
import {
  getSalesMutationOperationHeaders,
  withSalesMutationOperationNetUid,
  type SalesMutationOperationOptions,
} from '../../sales-ukraine/salesMutationOperation'
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
      includeDetails: false,
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

export async function updateWarehouseUkraineSale(
  sale: Sale,
  operation: SalesMutationOperationOptions,
): Promise<Sale> {
  // The list projection loads with includeDetails=false, so Order.OrderPackages arrives empty.
  // Posting that back would make the server treat the sale as having zero packages and soft-delete
  // every real OrderPackage (RemoveAllByOrderId). Strip Order so the packing block is skipped while
  // the flag/status/TTN updates still apply.
  const result = await apiRequest<unknown>('/sales/update', {
    method: 'POST',
    body: withSalesMutationOperationNetUid({ ...sale, Order: null }, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    ...(operation.signal ? { signal: operation.signal } : {}),
  })

  return result && typeof result === 'object' ? (result as Sale) : sale
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
  return normalizeSharedExportDocument(result)
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
