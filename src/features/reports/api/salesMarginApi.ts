import { apiRequest } from '../../../shared/api/apiClient'
import { createSalesMarginRequest, isSalesMarginCapabilities, normalizeSalesMarginReport,
  type SalesMarginCapabilities, type SalesMarginReport } from '../data/salesMargin'

const route = '/report/constructors/sales-margin'
export async function getSalesMarginCapabilities(signal?: AbortSignal): Promise<SalesMarginCapabilities> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal, dedupe: false })
  if (!isSalesMarginCapabilities(value)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return value
}
/** The preview and two files are delivered by the same authorized calculation. */
export async function previewSalesMargin(capability: SalesMarginCapabilities, month: string, signal?: AbortSignal): Promise<SalesMarginReport> {
  const request = createSalesMarginRequest(capability, month)
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false })
  return normalizeSalesMarginReport(value, request)
}
