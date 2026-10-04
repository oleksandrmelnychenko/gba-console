import { apiRequest } from '../../../shared/api/apiClient'
import { isBuyerOrdersCapability, normalizeBuyerOrders, type BuyerOrdersCapability, type BuyerOrdersRequest, type BuyerOrdersResult } from '../data/originalBuyerOrders'
const route = '/report/originals/buyer-orders'
export async function getBuyerOrdersCapability(signal?: AbortSignal): Promise<BuyerOrdersCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal })
  if (!isBuyerOrdersCapability(value) || value.World !== 'fenix') throw new Error('Сервер не підтвердив відомість замовлень покупців Fenix.')
  return value
}
export async function readBuyerOrders(request: BuyerOrdersRequest, signal?: AbortSignal): Promise<BuyerOrdersResult> {
  return normalizeBuyerOrders(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
