import { apiRequest } from '../../../shared/api/apiClient'
import { isMoneyFlowCapability, normalizeMoneyFlow, type MoneyFlowCapability, type MoneyFlowRequest, type MoneyFlowResult } from '../data/originalMoneyFlowAnalysis'
const route = '/report/originals/money-flow-analysis'
export async function getMoneyFlowCapability(signal?: AbortSignal): Promise<MoneyFlowCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isMoneyFlowCapability(value)) throw new Error('Сервер не підтвердив оригінальний аналіз руху коштів Fenix.')
  return value
}
export async function readMoneyFlow(request: MoneyFlowRequest, signal?: AbortSignal): Promise<MoneyFlowResult> {
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal })
  return normalizeMoneyFlow(value, request)
}
