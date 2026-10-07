import { apiRequest } from '../../../shared/api/apiClient'
import { isDefectCostCapability, normalizeDefectCost, normalizeDefectCostChoices, validateDefectCostRequest, type DefectCostCapability, type DefectCostRequest, type DefectCostResult, type DefectCostChoicesResult } from '../data/originalDefectCost'
const route = '/report/originals/defect-cost'
export async function getDefectCostCapability(signal?: AbortSignal): Promise<DefectCostCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isDefectCostCapability(value)) throw new Error('Сервер не підтвердив оригінальний звіт про вартість браку Fenix.')
  return value
}
export async function readDefectCost(request: DefectCostRequest, signal?: AbortSignal): Promise<DefectCostResult> {
  const detached = validateDefectCostRequest(request)
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: detached, dedupe: false, signal })
  return normalizeDefectCost(value, detached)
}

export async function readDefectCostChoices(request: DefectCostRequest, signal?: AbortSignal): Promise<DefectCostChoicesResult> {
  const detached = validateDefectCostRequest(request)
  const value = await apiRequest<unknown>(`${route}/choices`, { method: 'POST', body: detached, dedupe: false, signal })
  return normalizeDefectCostChoices(value, detached)
}
