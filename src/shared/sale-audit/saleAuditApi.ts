import { apiRequest } from '../api/apiClient'
import {
  getSalesMutationOperationHeaders,
  type SalesMutationOperationOptions,
  type SalesMutationOperationPayload,
  withSalesMutationOperationNetUid,
} from '../../features/sales-ukraine/salesMutationOperation'
import { requirePersistedGuid } from '../../features/sales-ukraine/salesPayloadGuards'
import type { SaleAuditPrintDocument, SaleAuditStatistic } from './saleAuditTypes'

export async function getWarehouseUkraineSaleAudit(netId: string): Promise<SaleAuditStatistic | null> {
  const result = await apiRequest<unknown>('/sales/warehouse-ukraine/editing/audit', {
    query: {
      netId,
    },
  })

  return normalizeObject<SaleAuditStatistic>(result)
}

export async function getSalesUkraineSaleAudit(netId: string): Promise<SaleAuditStatistic | null> {
  const result = await apiRequest<unknown>('/sales/ukraine/audit', {
    query: { netId },
  })

  return normalizeObject<SaleAuditStatistic>(result)
}

export async function getSalesUkraineEditSaleStatistic(netId: string): Promise<SaleAuditStatistic | null> {
  const result = await apiRequest<unknown>('/sales/ukraine/edit/shifted', {
    query: { netId },
  })

  return normalizeObject<SaleAuditStatistic>(result)
}

export async function getWarehouseUkraineAuditInvoiceDocument(
  netId: string,
  historyNetId: string,
): Promise<SaleAuditPrintDocument | null> {
  const result = await apiRequest<unknown>('/sales/warehouse-ukraine/editing/audit/invoice-document', {
    query: {
      historyNetId,
      netId,
    },
  })

  return normalizeDocument(result)
}

export async function getSalesUkraineSaleAuditInvoiceDocument(
  netId: string,
  historyNetId: string,
): Promise<SaleAuditPrintDocument | null> {
  const result = await apiRequest<unknown>('/sales/ukraine/audit/invoice-document', {
    query: {
      historyNetId,
      netId,
    },
  })

  return normalizeDocument(result)
}

export async function getWarehouseUkraineAuditShiftedDocument(
  netId: string,
  historyNetId: string,
): Promise<SaleAuditPrintDocument | null> {
  const result = await apiRequest<unknown>('/sales/warehouse-ukraine/editing/audit/shifted-document', {
    query: {
      historyNetId,
      netId,
    },
  })

  return normalizeDocument(result)
}

export async function getSalesUkraineSaleAuditShiftedDocument(
  netId: string,
  historyNetId: string,
): Promise<SaleAuditPrintDocument | null> {
  const result = await apiRequest<unknown>('/sales/ukraine/audit/shifted-document', {
    query: {
      historyNetId,
      netId,
    },
  })

  return normalizeDocument(result)
}

export type SaleAuditHistoryMutationPayload = {
  NetId: string
} & SalesMutationOperationPayload

export async function confirmSalesUkraineSaleAuditHistory(
  payload: SaleAuditHistoryMutationPayload,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  return confirmSaleAuditHistoryAt(
    '/protocol/act/invoice/ukraine/set/edit/act/for/editing',
    payload,
    operation,
  )
}

async function confirmSaleAuditHistoryAt(
  path: string,
  payload: SaleAuditHistoryMutationPayload,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  const historyNetId = requirePersistedGuid(
    payload.NetId,
    'Не вдалося визначити акт редагування накладної',
  )

  await apiRequest<unknown>(path, {
    body: withSalesMutationOperationNetUid(
      { NetId: historyNetId },
      operation.operationId,
    ),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    ...(operation.signal ? { signal: operation.signal } : {}),
  })
}

function normalizeDocument(result: unknown): SaleAuditPrintDocument | null {
  return result && typeof result === 'object' && !Array.isArray(result) ? (result as SaleAuditPrintDocument) : null
}

function normalizeObject<T>(result: unknown): T | null {
  return result && typeof result === 'object' && !Array.isArray(result) ? (result as T) : null
}
