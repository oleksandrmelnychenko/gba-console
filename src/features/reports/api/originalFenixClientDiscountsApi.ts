import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeFenixChoices, normalizeFenixDiscounts, normalizeFenixReadiness, validateFenixDiscountRequest, type FenixDiscountRequest } from '../data/originalFenixClientDiscounts'
const route = '/report/originals/fenix/client-discounts'
export async function getFenixDiscountReadiness(signal?: AbortSignal) { return normalizeFenixReadiness(await apiRequest<unknown>(`${route}/readiness`, { signal })) }
export async function readFenixDiscountChoices(request: FenixDiscountRequest, signal?: AbortSignal) {
  const scope = validateFenixDiscountRequest({ ...request, ChoicesWitnessSha256: null })
  return normalizeFenixChoices(await apiRequest<unknown>(`${route}/choices`, { method: 'POST', body: scope, dedupe: false, signal }), scope)
}
export async function readFenixDiscounts(request: FenixDiscountRequest, signal?: AbortSignal) {
  const scope = validateFenixDiscountRequest(request)
  return normalizeFenixDiscounts(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: scope, dedupe: false, signal }), scope)
}
