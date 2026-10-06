import { apiRequest } from '../../../shared/api/apiClient'
import { isOrderAnalysisCapability, orderAnalysisInvalid, type OrderAnalysisCapability, type OrderAnalysisKind, type OrderAnalysisRequest } from '../data/originalOrderAnalyses'
import { normalizeOrderAnalysisChoices, normalizeOrderAnalysisResult } from '../data/originalOrderAnalysisResponse'
const route = '/report/originals/order-analyses'
export async function getOriginalOrderAnalysisCapability(kind: OrderAnalysisKind, signal?: AbortSignal): Promise<OrderAnalysisCapability> {
  const result = await apiRequest<unknown>(`${route}/capabilities?world=fenix&kind=${kind}`, { signal })
  if (!isOrderAnalysisCapability(result, kind)) throw orderAnalysisInvalid()
  return result
}
export async function readOriginalOrderAnalysisChoices(request: OrderAnalysisRequest, signal?: AbortSignal) {
  return normalizeOrderAnalysisChoices(await apiRequest<unknown>(`${route}/choices`, { method: 'POST', body: request, signal, dedupe: false }), request)
}
export async function readOriginalOrderAnalyses(request: OrderAnalysisRequest, signal?: AbortSignal) {
  return normalizeOrderAnalysisResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false }), request)
}
