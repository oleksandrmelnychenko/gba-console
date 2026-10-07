import { apiRequest } from '../../../shared/api/apiClient'
import { createOriginalRevenueRequest, isOriginalRevenueCapabilities, normalizeOriginalRevenueReport,
  type OriginalRevenueCapabilities, type OriginalRevenueReport } from '../data/originalRevenue'

const route = '/report/constructors/revenue-comparison'
export async function getOriginalRevenueCapabilities(signal?: AbortSignal): Promise<OriginalRevenueCapabilities> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isOriginalRevenueCapabilities(value)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return value
}
export async function previewOriginalRevenue(capability: OriginalRevenueCapabilities, month: string): Promise<OriginalRevenueReport> {
  const request = createOriginalRevenueRequest(capability, month)
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false })
  return normalizeOriginalRevenueReport(value, request)
}
