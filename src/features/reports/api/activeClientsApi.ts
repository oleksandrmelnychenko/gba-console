import { apiRequest } from '../../../shared/api/apiClient'
import {
  createActiveClientsRequest,
  isActiveClientsCapabilities,
  normalizeActiveClientsReport,
  type ActiveClientsCapabilities,
  type ActiveClientsReport,
} from '../data/activeClients'

const route = '/report/constructors/active-clients'

export async function getActiveClientsCapabilities(signal?: AbortSignal): Promise<ActiveClientsCapabilities> {
  const result = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isActiveClientsCapabilities(result)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return result
}

/** The authenticated preview supplies all cells and both caller-bound export links. */
export async function previewActiveClients(capability: ActiveClientsCapabilities, month: string): Promise<ActiveClientsReport> {
  const request = createActiveClientsRequest(capability, month)
  const result = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request })
  return normalizeActiveClientsReport(result, request)
}
