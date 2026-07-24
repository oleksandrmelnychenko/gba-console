import { apiRequest } from '../api/apiClient'
import {
  getSalesMutationOperationHeaders,
  type SalesMutationOperationOptions,
  type SalesMutationOperationPayload,
  withSalesMutationOperationNetUid,
} from '../../features/sales-ukraine/salesMutationOperation'
import { requirePersistedGuid } from '../../features/sales-ukraine/salesPayloadGuards'
import type { SaleAuditPrintDocument, SaleAuditStatistic } from './saleAuditTypes'

export async function getSaleStatisticBySaleId(netId: string): Promise<SaleAuditStatistic | null> {
  const result = await apiRequest<unknown>('/sales/get/shifted', {
    query: {
      netId,
    },
  })

  return normalizeObject<SaleAuditStatistic>(result)
}

export async function getShiftedSaleDocument(netId: string, historyNetId: string): Promise<SaleAuditPrintDocument | null> {
  const result = await apiRequest<unknown>('/sales/get/document/history', {
    query: {
      historyNetId,
      netId,
    },
  })

  return normalizeDocument(result)
}

export async function getShiftedSaleHistoryDocument(
  netId: string,
  historyNetId: string,
): Promise<SaleAuditPrintDocument | null> {
  const result = await apiRequest<unknown>('/sales/get/shifted/hisotry/document', {
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

export async function confirmSaleAuditHistory(
  payload: SaleAuditHistoryMutationPayload,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  const historyNetId = requirePersistedGuid(
    payload.NetId,
    'Не вдалося визначити акт редагування накладної',
  )

  await apiRequest<unknown>('/protocol/act/invoice/set/edit/act/for/editing', {
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
