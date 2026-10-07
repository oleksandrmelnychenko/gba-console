import { apiRequest } from '../../../shared/api/apiClient'
import { isPriceSalesCapability, isPriceSalesChoices, normalizePriceSales, type PriceSalesCapability, type PriceSalesChoice, type PriceSalesRequest, type PriceSalesResult } from '../data/originalPriceTypeSales'
const route = '/report/originals/price-type-sales'
export async function getPriceSalesCapability(signal?: AbortSignal): Promise<PriceSalesCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isPriceSalesCapability(value)) throw new Error('Сервер не підтвердив оригінал Fenix порівняння продажів за типом цін.')
  return value
}
export async function getPriceSalesTypes(signal?: AbortSignal): Promise<PriceSalesChoice[]> {
  const value = await apiRequest<unknown>(`${route}/price-types`, { signal })
  if (!isPriceSalesChoices(value)) throw new Error('Сервер не підтвердив назви типів цін Fenix.')
  return value
}
export async function readPriceSales(request: PriceSalesRequest, signal?: AbortSignal): Promise<PriceSalesResult> {
  return normalizePriceSales(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
