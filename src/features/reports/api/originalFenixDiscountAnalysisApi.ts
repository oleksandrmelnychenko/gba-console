import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeFenixDiscountCapability, normalizeFenixDiscountResult, validateFenixDiscountRequest, type FenixDiscountRequest } from '../data/originalFenixDiscountAnalysis'
const route = '/report/originals/discount-analysis'
export async function getFenixDiscountCapability(signal?: AbortSignal) {
  return normalizeFenixDiscountCapability(await apiRequest<unknown>(`${route}/capabilities`, { signal }))
}
export async function readFenixDiscountAnalysis(request: FenixDiscountRequest, signal?: AbortSignal) {
  const scope = validateFenixDiscountRequest(request)
  return normalizeFenixDiscountResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: scope, dedupe: false, signal }), scope)
}
