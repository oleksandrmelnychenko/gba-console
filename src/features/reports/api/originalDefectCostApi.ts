import { apiRequest } from '../../../shared/api/apiClient'
import { isDefectCostCapability, normalizeDefectCost, validateDefectCostRequest, type DefectCostCapability, type DefectCostRequest, type DefectCostResult } from '../data/originalDefectCost'
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
