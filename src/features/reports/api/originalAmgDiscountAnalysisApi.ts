import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeAmgDiscountAnalysisCapability, normalizeAmgDiscountAnalysisResult, validateAmgDiscountAnalysisRequest, type AmgDiscountAnalysisRequest } from '../data/originalAmgDiscountAnalysis'
import { normalizeAmgDiscountAnalysisChoices, normalizeAmgDiscountAnalysisReadiness } from '../data/originalAmgDiscountAnalysisChoices'
const route = '/report/originals/amg/discount-analysis'
export async function getAmgDiscountAnalysisCapability(signal?: AbortSignal) {
  return normalizeAmgDiscountAnalysisCapability(await apiRequest<unknown>(`${route}/capabilities`, { signal }))
}
export async function readAmgDiscountAnalysis(request: AmgDiscountAnalysisRequest, signal?: AbortSignal) {
  const scope = validateAmgDiscountAnalysisRequest(request)
  return normalizeAmgDiscountAnalysisResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: scope, dedupe: false, signal }), scope)
}

export async function getAmgDiscountAnalysisReadiness(signal?: AbortSignal) {
  return normalizeAmgDiscountAnalysisReadiness(await apiRequest<unknown>(`${route}/readiness`, { signal }))
}
export async function readAmgDiscountAnalysisChoices(request: AmgDiscountAnalysisRequest, signal?: AbortSignal) {
  const scope = validateAmgDiscountAnalysisRequest(request)
  return normalizeAmgDiscountAnalysisChoices(await apiRequest<unknown>(`${route}/choices`, { method: 'POST', body: scope, dedupe: false, signal }), scope)
}
