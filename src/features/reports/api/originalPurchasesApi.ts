import { apiRequest } from '../../../shared/api/apiClient'
import { isPurchasesCapability, normalizePurchases, validatePurchasesRequest, type PurchasesCapability, type PurchasesRequest, type PurchasesResult } from '../data/originalPurchases'
const route = '/report/originals/purchases'
export async function getPurchasesCapability(signal?: AbortSignal): Promise<PurchasesCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isPurchasesCapability(value)) throw new Error('Сервер не підтвердив оригінальний звіт «Закупки» Fenix.')
  return value
}
export async function readPurchases(request: PurchasesRequest, signal?: AbortSignal): Promise<PurchasesResult> {
  const detached = validatePurchasesRequest(request)
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: detached, dedupe: false, signal })
  return normalizePurchases(value, detached)
}
