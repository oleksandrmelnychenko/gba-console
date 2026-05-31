import { apiRequest } from '../../../shared/api/apiClient'
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
  const result = await apiRequest<unknown>('/protocol/act/invoice/get/edit/act/for/editing/qty')

  return readQty(result)
}

export async function getEditingCarrierQty(): Promise<number> {
  const result = await apiRequest<unknown>('/protocol/act/invoice/get/edit/transporters/qty')

  return readQty(result)
}

export async function getEditingActList(params: EditingListSearchParams): Promise<EditingItemsResponse> {
  const result = await apiRequest<unknown>('/protocol/act/invoice/get/edit/act/for/editing', {
    query: buildQuery(params),
  })

  return normalizeEditingResponse(result)
}

export async function getEditingCarrierList(params: EditingListSearchParams): Promise<EditingItemsResponse> {
  const result = await apiRequest<unknown>('/protocol/act/invoice/get/edit/transporters', {
    query: buildQuery(params),
  })

  return normalizeEditingResponse(result)
}

export async function approveEditingAct(historyNetId: string): Promise<void> {
  await apiRequest<unknown>('/protocol/act/invoice/set/edit/act/for/editing', {
    query: {
      historynetId: historyNetId,
    },
  })
}

export async function approveEditingCarrier(updateNetId: string): Promise<void> {
  await apiRequest<unknown>('/protocol/act/invoice/set/warehouses/shipment/history', {
    query: {
      netId: updateNetId,
    },
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
