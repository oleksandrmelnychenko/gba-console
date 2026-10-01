import { apiRequest } from '../../../shared/api/apiClient'
import {
  createDebtToSalesRatioRequest,
  isDebtToSalesRatioCapabilities,
  normalizeDebtToSalesRatioReport,
  type DebtToSalesRatioCapabilities,
  type DebtToSalesRatioReport,
} from '../data/debtToSalesRatio'

const route = '/report/constructors/debt-to-sales-ratio'

export async function getDebtToSalesRatioCapabilities(signal?: AbortSignal): Promise<DebtToSalesRatioCapabilities> {
  const result = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isDebtToSalesRatioCapabilities(result)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return result
}

/** One server calculation supplies the on-screen cells and both export links. */
export async function previewDebtToSalesRatio(capability: DebtToSalesRatioCapabilities, month: string): Promise<DebtToSalesRatioReport> {
  const request = createDebtToSalesRatioRequest(capability, month)
  const result = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false })
  return normalizeDebtToSalesRatioReport(result, request)
}
