import { apiRequest } from '../../../shared/api/apiClient'
import { isStockCapability, type StockCapability, type StockRequest } from '../data/originalStockAvailability'
import { normalizeStockResult } from '../data/originalStockAvailabilityResponse'
const route = '/report/originals/fenix/stock-availability'
export async function getOriginalStockAvailabilityCapability(signal?: AbortSignal): Promise<StockCapability> {
  const result = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isStockCapability(result)) throw new Error('Сервер не підтвердив звіт доступності товарів Fenix.')
  return result
}
export async function readOriginalStockAvailability(request: StockRequest, signal?: AbortSignal) {
  return normalizeStockResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false }), request)
}
