import { apiRequest } from '../../../shared/api/apiClient'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import type {
  AccountableExpensesResponse,
  AccountableExpensesSearchParams,
  ConsumablesOrder,
  ConsumablesOrderItem,
  OutcomePaymentOrderConsumablesOrder,
} from '../types'

export async function getAccountableExpenses(params: AccountableExpensesSearchParams): Promise<AccountableExpensesResponse> {
  const result = await apiRequest<unknown>('/consumables/orders/all/services', {
    query: {
      from: toDateTimeQuery(params.from, 'start'),
      limit: params.limit,
      offset: params.offset,
      to: toDateTimeQuery(params.to, 'end'),
      value: '',
    },
  })

  return normalizeConsumablesOrdersResponse(result)
}

export async function searchAccountableExpenses(
  value: string,
  params: AccountableExpensesSearchParams,
): Promise<AccountableExpensesResponse> {
  const result = await apiRequest<unknown>('/consumables/orders/all/services', {
    query: {
      from: toDateTimeQuery(params.from, 'start'),
      limit: params.limit,
      offset: params.offset,
      to: toDateTimeQuery(params.to, 'end'),
      value,
    },
  })

  return normalizeConsumablesOrdersResponse(result)
}

function normalizeConsumablesOrdersResponse(result: unknown): AccountableExpensesResponse {
  const items = normalizeConsumablesOrders(result)
  const payload = result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : {}
  const total = readNumber(payload.TotalRowsQty, readNumber(payload.TotalRowQty, readNumber(payload.Total)))
    ?? readNumber(items[0]?.TotalRowsQty, readNumber(items[0]?.TotalRowQty))

  return {
    Items: items,
    Total: total,
  }
}

function normalizeConsumablesOrders(result: unknown): ConsumablesOrder[] {
  return readArrayPayload(result, ['Collection', 'Items', 'ConsumablesOrders', 'Data'])
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
          .map(normalizeOutcomeConsumablesOrderLink)
          .filter((link): link is OutcomePaymentOrderConsumablesOrder => Boolean(link))
      : [],
  }
}

function normalizeOutcomeConsumablesOrderLink(result: unknown): OutcomePaymentOrderConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as OutcomePaymentOrderConsumablesOrder
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

function readNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return fallback
}
