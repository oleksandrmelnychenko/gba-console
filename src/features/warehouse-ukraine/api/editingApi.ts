import { apiRequest } from '../../../shared/api/apiClient'
import {
  getSalesMutationOperationHeaders,
  type SalesMutationOperationOptions,
  type SalesMutationOperationPayload,
  withSalesMutationOperationNetUid,
} from '../../sales-ukraine/salesMutationOperation'
import { requirePersistedGuid } from '../../sales-ukraine/salesPayloadGuards'
import type { EditingActItem, EditingItemsResponse } from '../types'
import { readArrayPayload, readNumber } from './salesApi'

export type EditingListSearchParams = {
  from: string
  to: string
  limit: number
  offset: number
  isDevelopment: boolean
}

export async function getEditingActQty(): Promise<number> {
  const result = await apiRequest<unknown>('/protocol/act/invoice/warehouse-ukraine/acts/qty')

  return readQty(result)
}

export async function getEditingCarrierQty(): Promise<number> {
  const result = await apiRequest<unknown>('/protocol/act/invoice/warehouse-ukraine/carriers/qty')

  return readQty(result)
}

export async function getEditingActList(params: EditingListSearchParams): Promise<EditingItemsResponse> {
  const result = await apiRequest<unknown>('/protocol/act/invoice/warehouse-ukraine/acts', {
    query: buildQuery(params),
  })

  return normalizeEditingResponse(result)
}

export async function getEditingCarrierList(params: EditingListSearchParams): Promise<EditingItemsResponse> {
  const result = await apiRequest<unknown>('/protocol/act/invoice/warehouse-ukraine/carriers', {
    query: buildQuery(params),
  })

  return normalizeEditingResponse(result)
}

export type EditingMutationPayload = {
  NetId: string
}

type DurableEditingMutationPayload =
  EditingMutationPayload & SalesMutationOperationPayload

export async function approveEditingAct(
  payload: DurableEditingMutationPayload,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  const historyNetId = requirePersistedGuid(
    payload.NetId,
    'Не вдалося визначити акт редагування накладної',
  )

  await apiRequest<unknown>('/protocol/act/invoice/warehouse-ukraine/process-act', {
    body: withSalesMutationOperationNetUid(
      { NetId: historyNetId },
      operation.operationId,
    ),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    ...(operation.signal ? { signal: operation.signal } : {}),
  })
}

export async function approveEditingCarrier(
  payload: DurableEditingMutationPayload,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  const historyNetId = requirePersistedGuid(
    payload.NetId,
    'Не вдалося визначити історію зміни перевізника',
  )

  await apiRequest<unknown>('/protocol/act/invoice/warehouse-ukraine/process-carrier', {
    body: withSalesMutationOperationNetUid(
      { NetId: historyNetId },
      operation.operationId,
    ),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    ...(operation.signal ? { signal: operation.signal } : {}),
  })
}

function buildQuery(params: EditingListSearchParams) {
  return {
    from: params.from,
    to: params.to,
    limit: params.limit,
    offset: params.offset,
    isDevelopment: params.isDevelopment,
  }
}

function readQty(result: unknown): number {
  if (typeof result === 'number') {
    return result
  }

  const direct = readNumber(result)

  if (typeof direct === 'number') {
    return direct
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>
    return readNumber(payload.Qty) ?? readNumber(payload.Total) ?? readNumber(payload.Count) ?? 0
  }

  return 0
}

function normalizeEditingResponse(result: unknown): EditingItemsResponse {
  const items = readArrayPayload(result, ['Items', 'Data']) as EditingActItem[]
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const totalQty =
    readNumber(payload.TotalRowsQty) ??
    readNumber(payload.Total) ??
    readNumber(items[0]?.TotalRowsQty) ??
    items.length

  return { items, totalQty }
}
