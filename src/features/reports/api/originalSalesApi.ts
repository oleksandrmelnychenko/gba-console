import { apiRequest } from '../../../shared/api/apiClient'
import { isSalesCapability, normalizeSales, type SalesCapability, type SalesRequest, type SalesResult } from '../data/originalSales'
const route = '/report/originals/sales'
export async function getSalesCapability(signal?: AbortSignal): Promise<SalesCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isSalesCapability(value)) throw new Error('Сервер не підтвердив оригінал Fenix продажів.')
  return value
}
export async function readSales(request: SalesRequest, signal?: AbortSignal): Promise<SalesResult> {
  return normalizeSales(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
