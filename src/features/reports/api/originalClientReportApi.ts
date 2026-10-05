import { apiRequest } from '../../../shared/api/apiClient'
import { isClientCapability, normalizeClientResult, type ClientCapability, type ClientRequest } from '../data/originalClientReport'
const route = '/report/original-client-report'
export async function getClientReportCapability(signal?: AbortSignal): Promise<ClientCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isClientCapability(value)) throw new Error('Сервер не підтвердив оригінал звіту за клієнтами Fenix.')
  return value
}
export async function readClientReport(request: ClientRequest, signal?: AbortSignal) {
  return normalizeClientResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
