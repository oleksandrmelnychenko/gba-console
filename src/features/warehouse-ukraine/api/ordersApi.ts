import { apiRequest } from '../../../shared/api/apiClient'
import type { SupplyOrderUkraine, SupplyOrdersResponse } from '../types'
import { readArrayPayload, readNumber } from './salesApi'

export type SupplyOrdersSearchParams = {
  from: string
  to: string
  limit: number
  offset: number
  placed?: boolean
}

export async function getWarehouseUkraineOrders(
  params: SupplyOrdersSearchParams,
): Promise<SupplyOrdersResponse> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/all/filtered', {
    query: {
      from: params.from,
      to: params.to,
      limit: params.limit,
      offset: params.offset,
      placed: params.placed,
    },
  })

  return normalizeSupplyOrdersResponse(result)
}

function normalizeSupplyOrdersResponse(result: unknown): SupplyOrdersResponse {
  const items = readArrayPayload(result, ['Items', 'SupplyUkraineOrders', 'Data']) as SupplyOrderUkraine[]
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const totalQty =
    readNumber(payload.TotalRowsQty) ??
    readNumber(payload.Total) ??
    readNumber(items[0]?.TotalRowsQty) ??
    items.length

  return { items, totalQty }
}
