import { apiRequest } from '../../../shared/api/apiClient'
import { CASH_MOVEMENT_DEFINITIONS, cashMovementKind, createCashMovementRequest, isCashMovementCapabilities, normalizeCashMovementReport,
  type CashMovementCapabilities, type CashMovementKind, type CashMovementReport } from '../data/cashMovement'

export async function getCashMovementCapabilities(kind: CashMovementKind, signal?: AbortSignal): Promise<CashMovementCapabilities> {
  const value = await apiRequest<unknown>(`${CASH_MOVEMENT_DEFINITIONS[kind].Route}/capabilities`, { signal, dedupe: false })
  if (!isCashMovementCapabilities(value, kind)) throw new Error('Сервер не підтвердив параметри цієї форми руху коштів.')
  return value
}
export async function previewCashMovement(capability: CashMovementCapabilities, period: string, signal?: AbortSignal): Promise<CashMovementReport> {
  const request = createCashMovementRequest(capability, period), kind = cashMovementKind(capability)!
  const value = await apiRequest<unknown>(`${CASH_MOVEMENT_DEFINITIONS[kind].Route}/preview`, { method: 'POST', body: request, signal, dedupe: false })
  return normalizeCashMovementReport(value, request)
}
