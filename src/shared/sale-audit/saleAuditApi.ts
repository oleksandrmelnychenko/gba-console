import { apiRequest } from '../api/apiClient'
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

export async function confirmSaleAuditHistory(historyNetId: string): Promise<void> {
  await apiRequest<unknown>('/protocol/act/invoice/set/edit/act/for/editing', {
    query: { historyNetId },
  })
}

function normalizeDocument(result: unknown): SaleAuditPrintDocument | null {
  return result && typeof result === 'object' && !Array.isArray(result) ? (result as SaleAuditPrintDocument) : null
}

function normalizeObject<T>(result: unknown): T | null {
  return result && typeof result === 'object' && !Array.isArray(result) ? (result as T) : null
}
