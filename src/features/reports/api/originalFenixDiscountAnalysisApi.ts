import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeFenixDiscountCapability, normalizeFenixDiscountResult, validateFenixDiscountRequest, type FenixDiscountRequest } from '../data/originalFenixDiscountAnalysis'
import { normalizeFenixDiscountChoices, normalizeFenixDiscountReadiness } from '../data/originalFenixDiscountAnalysisChoices'
const route = '/report/originals/discount-analysis'
export async function getFenixDiscountCapability(signal?: AbortSignal) {
  return normalizeFenixDiscountCapability(await apiRequest<unknown>(`${route}/capabilities`, { signal }))
}
export async function readFenixDiscountAnalysis(request: FenixDiscountRequest, signal?: AbortSignal) {
  const scope = validateFenixDiscountRequest(request)
  return normalizeFenixDiscountResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: scope, dedupe: false, signal }), scope)
}
export async function getFenixDiscountReadiness(signal?: AbortSignal) {
  return normalizeFenixDiscountReadiness(await apiRequest<unknown>(`${route}/readiness`, { signal }))
}
export async function readFenixDiscountChoices(request: FenixDiscountRequest, signal?: AbortSignal) {
  const current = validateFenixDiscountRequest(request)
  return normalizeFenixDiscountChoices(await apiRequest<unknown>(`${route}/choices`, { method: 'POST', body: current, dedupe: false, signal }), current)
}
