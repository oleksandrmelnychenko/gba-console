import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AccountableExpensesSearchParams,
  ConsumablesOrder,
  ConsumablesOrderItem,
} from '../types'

export async function getAccountableExpenses(params: AccountableExpensesSearchParams): Promise<ConsumablesOrder[]> {
  const result = await apiRequest<unknown>('/consumables/orders/all/services', {
    query: {
      from: params.from,
      to: params.to,
    },
  })

  return normalizeConsumablesOrders(result)
}

export async function searchAccountableExpenses(value: string): Promise<ConsumablesOrder[]> {
  const result = await apiRequest<unknown>('/consumables/orders/search', {
    query: {
      value,
    },
  })

  return normalizeConsumablesOrders(result)
}

function normalizeConsumablesOrders(result: unknown): ConsumablesOrder[] {
  return readArrayPayload(result, ['Items', 'ConsumablesOrders', 'ConsumableServices', 'Data'])
    .map(normalizeConsumablesOrder)
    .filter((order): order is ConsumablesOrder => Boolean(order))
}

function normalizeConsumablesOrder(result: unknown): ConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as ConsumablesOrder

  return {
    ...order,
    ConsumablesOrderItems: Array.isArray(order.ConsumablesOrderItems)
      ? order.ConsumablesOrderItems
          .map(normalizeConsumablesOrderItem)
          .filter((item): item is ConsumablesOrderItem => Boolean(item))
      : [],
    OutcomePaymentOrderConsumablesOrders: Array.isArray(order.OutcomePaymentOrderConsumablesOrders)
      ? order.OutcomePaymentOrderConsumablesOrders
      : [],
  }
}

function normalizeConsumablesOrderItem(result: unknown): ConsumablesOrderItem | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as ConsumablesOrderItem
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}
