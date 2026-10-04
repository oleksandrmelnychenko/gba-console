import { apiRequest } from '../../../shared/api/apiClient'
import { isDebtCapability, normalizeDebt, type DebtCapability, type DebtRequest, type DebtResult } from '../data/originalCounterpartyDebt'
const route = '/report/originals/counterparty-debt'
export async function getDebtCapability(signal?: AbortSignal): Promise<DebtCapability> {
  const response = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isDebtCapability(response)) throw new Error('Сервер не підтвердив оригінал заборгованості Fenix.')
  return response
}
export async function readDebt(request: DebtRequest, signal?: AbortSignal): Promise<DebtResult> {
  return normalizeDebt(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
