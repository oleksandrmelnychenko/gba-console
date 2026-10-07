import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeAmgChoices, normalizeAmgDiscounts, normalizeAmgReadiness, validateAmgDiscountRequest, type AmgDiscountRequest } from '../data/originalAmgClientDiscounts'
const route = '/report/originals/amg/client-discounts'
export async function getAmgDiscountReadiness(signal?: AbortSignal) { return normalizeAmgReadiness(await apiRequest<unknown>(`${route}/readiness`, { signal })) }
export async function readAmgDiscountChoices(request: AmgDiscountRequest, signal?: AbortSignal) {
  const scope = validateAmgDiscountRequest({ ...request, ChoicesWitnessSha256: null })
  return normalizeAmgChoices(await apiRequest<unknown>(`${route}/choices`, { method: 'POST', body: scope, dedupe: false, signal }), scope)
}
export async function readAmgDiscounts(request: AmgDiscountRequest, signal?: AbortSignal) {
  const scope = validateAmgDiscountRequest(request)
  return normalizeAmgDiscounts(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: scope, dedupe: false, signal }), scope)
}
