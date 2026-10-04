import { apiRequest } from '../../../shared/api/apiClient'
import { isCashMovementsCapability, normalizeCashMovements, type CashMovementsCapability, type CashMovementsRequest, type CashMovementsResult } from '../data/originalCashMovements'
const route = '/report/originals/cash-movements'
export async function getCashMovementsCapability(signal?: AbortSignal): Promise<CashMovementsCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isCashMovementsCapability(value)) throw new Error('Сервер не підтвердив оригінальні рухи коштів Fenix.')
  return value
}
export async function readCashMovements(request: CashMovementsRequest, signal?: AbortSignal): Promise<CashMovementsResult> {
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal })
  return normalizeCashMovements(value, request)
}
