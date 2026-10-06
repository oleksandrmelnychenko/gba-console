import { apiRequest } from '../../../shared/api/apiClient'
import { isAvailabilityCapability, normalizeAvailabilityResult, type AvailabilityCapability, type AvailabilityRequest } from '../data/originalCashAvailability'
const route = '/report/originals/cash-availability'
export async function getOriginalCashAvailabilityCapability(signal?: AbortSignal): Promise<AvailabilityCapability> {
  const result = await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal })
  if (!isAvailabilityCapability(result)) throw new Error('Сервер не підтвердив звіт доступних коштів Fenix.')
  return result
}
export async function readOriginalCashAvailability(request: AvailabilityRequest, signal?: AbortSignal) {
  return normalizeAvailabilityResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false }), request)
}
