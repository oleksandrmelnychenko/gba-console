import { apiRequest } from '../../../shared/api/apiClient'
import type { DirectOrderProductIncome } from '../types'

export async function getDirectOrderProductIncome(orderNetId: string): Promise<DirectOrderProductIncome | null> {
  const result = await apiRequest<unknown>('/products/incomes/get/supply/order', {
    query: { netId: orderNetId },
    errorMessages: {
      default: 'Не вдалося завантажити оприходування',
      network: 'Сервер оприходування недоступний',
    },
  })

  return normalizeDirectOrderProductIncome(result)
}

export function normalizeDirectOrderProductIncome(result: unknown): DirectOrderProductIncome | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const income = result as DirectOrderProductIncome

  return hasDirectOrderProductIncome(income) ? income : null
}

export function hasDirectOrderProductIncome(income: DirectOrderProductIncome | null | undefined): boolean {
  return Boolean(income && ((income.Id || 0) > 0 || income.NetUid || income.Number))
}
