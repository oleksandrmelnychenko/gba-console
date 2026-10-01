import { apiRequest } from '../../../shared/api/apiClient'
import { createCashAggregateBalanceRequest, isCashAggregateBalanceCapabilities, normalizeCashAggregateBalanceReport,
  type CashAggregateBalanceCapabilities, type CashAggregateBalanceReport } from '../data/cashAggregateBalance'

const route = '/report/constructors/cash-aggregate-balance'
export async function getCashAggregateBalanceCapabilities(signal?: AbortSignal): Promise<CashAggregateBalanceCapabilities> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isCashAggregateBalanceCapabilities(value)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return value
}
export async function previewCashAggregateBalance(capability: CashAggregateBalanceCapabilities, period: string): Promise<CashAggregateBalanceReport> {
  const request = createCashAggregateBalanceRequest(capability, period)
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false })
  return normalizeCashAggregateBalanceReport(value, request)
}
