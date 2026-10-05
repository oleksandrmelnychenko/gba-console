import { apiRequest } from '../../../shared/api/apiClient'
import { isPlannedFlowCapability, normalizePlannedFlow, type PlannedFlowCapability, type PlannedFlowRequest } from '../data/originalPlannedCashFlow'
const route = '/report/originals/planned-cash-flow'
export async function getPlannedFlowCapability(signal?: AbortSignal): Promise<PlannedFlowCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal })
  if (!isPlannedFlowCapability(value)) throw new Error('Сервер не підтвердив оригінал плану руху коштів Fenix.')
  return value
}
export async function readPlannedFlow(request: PlannedFlowRequest, signal?: AbortSignal) {
  return normalizePlannedFlow(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
