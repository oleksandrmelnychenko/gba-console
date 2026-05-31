import { apiRequest } from '../../../shared/api/apiClient'
import type { ClientPrintDocument } from '../types'
import type { ClientSalesParams, SaleStatistic } from '../salesTypes'

function toLegacyDateParam(value: Date | string): string {
  return value instanceof Date ? value.toDateString() : value
}

export async function getSalesByClient(params: ClientSalesParams): Promise<SaleStatistic[]> {
  const result = await apiRequest<unknown>('/sales/all/client', {
    query: {
      netId: params.netId,
      from: toLegacyDateParam(params.from),
      to: toLegacyDateParam(params.to),
    },
  })

  return normalizeCollection<SaleStatistic>(result)
}

export async function getSaleStatisticBySaleId(netId: string): Promise<SaleStatistic | null> {
  const result = await apiRequest<unknown>('/sales/get/shifted', {
    query: {
      netId,
    },
  })

  return normalizeObject<SaleStatistic>(result)
}

export async function getShiftedSaleDocument(
  netId: string,
  historyNetId: string,
): Promise<ClientPrintDocument | null> {
  const result = await apiRequest<unknown>('/sales/get/document/history', {
    query: {
      netId,
      historyNetId,
    },
  })

  return normalizeDocument(result)
}

export async function getShiftedSaleHistoryDocument(
  netId: string,
  historyNetId: string,
): Promise<ClientPrintDocument | null> {
  const result = await apiRequest<unknown>('/sales/get/shifted/hisotry/document', {
    query: {
      netId,
      historyNetId,
    },
  })

  return normalizeDocument(result)
}

export async function confirmSaleActForEditing(historyNetId: string): Promise<void> {
  await apiRequest<unknown>('/protocol/act/invoice/set/edit/act/for/editing', {
    query: {
      historynetId: historyNetId,
    },
  })
}

function normalizeDocument(result: unknown): ClientPrintDocument | null {
  return result && typeof result === 'object' && !Array.isArray(result)
    ? (result as ClientPrintDocument)
    : null
}

function normalizeCollection<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (result && typeof result === 'object') {
    const items = (result as { Items?: unknown }).Items

    if (Array.isArray(items)) {
      return items as T[]
    }
  }

  return []
}

function normalizeObject<T>(result: unknown): T | null {
  return result && typeof result === 'object' && !Array.isArray(result) ? (result as T) : null
}
