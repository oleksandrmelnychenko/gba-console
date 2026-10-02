import { apiRequest } from '../../../shared/api/apiClient'
import { createOverdueReceivablesRequest, isOverdueReceivablesCapabilities, normalizeOverdueReceivablesReport,
  type OverdueReceivablesCapabilities, type OverdueReceivablesReport } from '../data/overdueReceivables'
const route = '/report/constructors/overdue-receivables'
export async function getOverdueReceivablesCapabilities(signal?: AbortSignal): Promise<OverdueReceivablesCapabilities> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal, dedupe: false })
  if (!isOverdueReceivablesCapabilities(value)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return value
}
export async function previewOverdueReceivables(capability: OverdueReceivablesCapabilities, month: string, signal?: AbortSignal): Promise<OverdueReceivablesReport> {
  const request = createOverdueReceivablesRequest(capability, month)
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false })
  return normalizeOverdueReceivablesReport(value, request)
}
