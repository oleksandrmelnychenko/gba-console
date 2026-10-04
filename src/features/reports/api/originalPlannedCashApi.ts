import { apiRequest } from '../../../shared/api/apiClient'
import { isPlannedCapability, normalizePlannedResult, type PlannedCapability, type PlannedRequest, type PlannedVariant } from '../data/originalPlannedCash'
const route = '/report/originals/planned-cash'
export async function getOriginalPlannedCapability(variant: PlannedVariant, signal?: AbortSignal): Promise<PlannedCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities?world=fenix&variant=${variant}`, { signal })
  if (!isPlannedCapability(value) || value.World !== 'fenix' || value.Variant !== variant) throw new Error('Сервер не підтвердив обраний плановий звіт Fenix.')
  return value
}
export async function readOriginalPlannedCash(request: PlannedRequest, signal?: AbortSignal) {
  return normalizePlannedResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
