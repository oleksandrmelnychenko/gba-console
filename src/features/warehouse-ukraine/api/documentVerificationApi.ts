import { apiRequest } from '../../../shared/api/apiClient'
import type {
  DocumentVerificationItem,
  DocumentVerificationResponse,
  WarehouseUkraineExportDocument,
  WarehouseUkraineStorage,
} from '../types'
import { normalizeExportDocument, readArrayPayload, readNumber } from './salesApi'

export type DocumentVerificationSearchParams = {
  from: string
  to: string
  limit: number
  offset: number
  storageIds: number[]
}

export async function getDocumentVerificationStorages(): Promise<WarehouseUkraineStorage[]> {
  const result = await apiRequest<unknown>('/storages/all')

  return readArrayPayload(result, ['Items', 'Storages', 'Data']) as WarehouseUkraineStorage[]
}

export async function getDocumentVerification(
  params: DocumentVerificationSearchParams,
): Promise<DocumentVerificationResponse> {
  const result = await apiRequest<unknown>('/history/order/item/get/verification', {
    query: {
      from: params.from,
      to: params.to,
      limit: params.limit,
      offset: params.offset,
      storageId: params.storageIds,
    },
  })

  return normalizeVerificationResponse(result)
}

export async function exportDocumentVerification(
  params: DocumentVerificationSearchParams,
): Promise<WarehouseUkraineExportDocument> {
  const result = await apiRequest<unknown>('/history/order/item/document/verification/create/export', {
    query: {
      from: params.from,
      to: params.to,
      limit: params.limit,
      offset: params.offset,
      storageId: params.storageIds,
    },
  })

  return normalizeExportDocument(result)
}

function normalizeVerificationResponse(result: unknown): DocumentVerificationResponse {
  const items = readArrayPayload(result, ['Items', 'DocumentRegister', 'Data']) as DocumentVerificationItem[]
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const totalQty =
    readNumber(payload.TotalRowQty) ??
    readNumber(payload.TotalRowsQty) ??
    readNumber(payload.Total) ??
    readNumber(items[0]?.TotalRowQty) ??
    items.length

  return { items, totalQty }
}
