import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeExportDocument as normalizeSharedExportDocument } from '../../../shared/documents/exportDocument'
import {
  getSalesMutationOperationHeaders,
  withSalesMutationOperationNetUid,
  type SalesMutationOperationOptions,
} from '../../sales-ukraine/salesMutationOperation'
import type { SalesUkraineSale } from '../../sales-ukraine/types'
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

export async function getWarehouseUkraineSales(
  params: SalesSearchParams,
  signal?: AbortSignal,
): Promise<SalesResponse> {
  const result = await apiRequest<unknown>('/sales/warehouse-ukraine/invoices/registry', {
    signal,
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

export async function getWarehouseUkraineSaleDetails(
  netId: string,
  signal?: AbortSignal,
): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/warehouse-ukraine/invoices/details', {
    query: { netId },
    ...(signal ? { signal } : {}),
  })

  return result && typeof result === 'object' && !Array.isArray(result) ? (result as SalesUkraineSale) : null
}

export async function getSalePrintDocument(saleNetId: string): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/sales/warehouse-ukraine/invoices/print', {
    query: {
      netId: saleNetId,
    },
  })

  return normalizeExportDocument(result)
}

export async function getSaleActProtocolEditDocument(
  saleNetId: string,
  isPrintedActProtocolEdit: boolean,
): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/sales/warehouse-ukraine/invoices/print-edit-act', {
    query: {
      netId: saleNetId,
      IsPrintedActProtocolEdit: isPrintedActProtocolEdit,
    },
  })

  return normalizeExportDocument(result)
}

export async function updateWarehouseUkraineSale(
  sale: Sale,
  printIntent: 'invoice' | 'act-protocol',
  operation: SalesMutationOperationOptions,
): Promise<Sale> {
  const path = printIntent === 'act-protocol'
    ? '/sales/warehouse-ukraine/invoices/mark-edit-act-printed'
    : '/sales/warehouse-ukraine/invoices/mark-printed'
  const result = await apiRequest<unknown>(path, {
    method: 'POST',
    body: withSalesMutationOperationNetUid({ NetUid: sale.NetUid }, operation.operationId),
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
