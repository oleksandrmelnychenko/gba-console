import { apiRequest } from '../../../shared/api/apiClient'
import { isCashCapability, normalizeCashResult, type CashCapability, type CashRequest } from '../data/originalCashStatement'
const route = '/report/originals/cash-statement'
export async function getOriginalCashCapability(signal?: AbortSignal): Promise<CashCapability> {
  const result = await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal })
  if (!isCashCapability(result) || result.World !== 'fenix') throw new Error('Сервер не підтвердив відомість коштів Fenix.')
  return result
}
export async function readOriginalCashStatement(request: CashRequest, signal?: AbortSignal) {
  return normalizeCashResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false }), request)
}
