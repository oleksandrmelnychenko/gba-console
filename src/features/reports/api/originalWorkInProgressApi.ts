import { apiRequest } from '../../../shared/api/apiClient'
import { isWipCapability, normalizeWip, type WipCapability, type WipRequest, type WipResult } from '../data/originalWorkInProgress'
const route = '/report/originals/work-in-progress'
export async function getWipCapability(signal?: AbortSignal): Promise<WipCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isWipCapability(value)) throw new Error('Сервер не підтвердив оригінал Fenix незавершеного виробництва.')
  return value
}
export async function readWip(request: WipRequest, signal?: AbortSignal): Promise<WipResult> {
  return normalizeWip(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
