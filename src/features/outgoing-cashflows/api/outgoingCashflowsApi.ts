import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ConsumablesOrderItem,
  Currency,
  Organization,
  OutcomePaymentOrder,
  OutcomePaymentOrderConsumablesOrder,
  OutgoingCashflowsResponse,
  OutgoingCashflowsSearchParams,
  PaymentMovement,
  PaymentRegister,
} from '../types'

export async function getOutgoingCashflows(params: OutgoingCashflowsSearchParams): Promise<OutgoingCashflowsResponse> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/all', {
    query: {
      currencyNetId: params.currencyNetId || undefined,
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      organizationIds: params.organizationIds?.length ? params.organizationIds : undefined,
      paymentMovementNetId: params.paymentMovementNetId || undefined,
      registerNetId: params.registerNetId || undefined,
      to: params.to,
      value: params.value || undefined,
    },
  })

  return normalizeOutgoingCashflowsResponse(result)
}

export async function getOutgoingCashflowByNetId(netId: string, signal?: AbortSignal): Promise<OutcomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/get', {
    query: {
      netId,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeOutcomePaymentOrder(result)
}

export async function cancelOutgoingCashflow(netId: string): Promise<OutcomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/cancel', {
    method: 'PUT',
    query: {
      netId,
    },
  })

  return normalizeCancelResult(result)
}

export async function getOutgoingCashflowCurrencies(): Promise<Currency[]> {
  const result = await apiRequest<unknown>('/currencies/all')

  return readArrayPayload(result, ['Items', 'Currencies', 'Data']) as Currency[]
}

export async function getOutgoingCashflowPaymentMovements(): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all')

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function searchOutgoingCashflowPaymentRegisters(value = ''): Promise<PaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentRegisters', 'Data']) as PaymentRegister[]
}

export async function getOutgoingCashflowOrganizations(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readArrayPayload(result, ['Items', 'Organizations', 'Organisations', 'Data']) as Organization[]
}

function normalizeOutgoingCashflowsResponse(result: unknown): OutgoingCashflowsResponse {
  const payload = result && typeof result === 'object' && !Array.isArray(result)
    ? (result as Partial<OutgoingCashflowsResponse>)
    : {}
  const collection = readCollection(readArrayPayload(result, ['Collection', 'Items', 'OutcomePaymentOrders', 'Data']))

  return {
    Collection: collection,
    NegativeDifferenceAmount: readNumber(payload.NegativeDifferenceAmount),
    PositiveDifferenceAmount: readNumber(payload.PositiveDifferenceAmount),
    TotalRowsQty:
      readOptionalNumber(payload.TotalRowsQty)
      ?? readOptionalNumber(payload.TotalQty)
      ?? readOptionalNumber(collection[0]?.TotalRowsQty)
      ?? readOptionalNumber(collection[0]?.TotalQty),
  }
}

function normalizeCancelResult(result: unknown): OutcomePaymentOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Record<string, unknown>
  const entity = payload.Entity || payload.OutcomePaymentOrder || payload.Data || result

  return normalizeOutcomePaymentOrder(entity)
}

function readCollection(value: unknown[]): OutcomePaymentOrder[] {
  return value
    .map(normalizeOutcomePaymentOrder)
    .filter((order): order is OutcomePaymentOrder => Boolean(order))
}

function normalizeOutcomePaymentOrder(result: unknown): OutcomePaymentOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as OutcomePaymentOrder

  return {
    ...order,
    OutcomePaymentOrderConsumablesOrders: Array.isArray(order.OutcomePaymentOrderConsumablesOrders)
      ? order.OutcomePaymentOrderConsumablesOrders
          .map(normalizeOutcomePaymentOrderConsumablesOrder)
          .filter((item): item is OutcomePaymentOrderConsumablesOrder => Boolean(item))
      : [],
  }
}

function normalizeOutcomePaymentOrderConsumablesOrder(result: unknown): OutcomePaymentOrderConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const item = result as OutcomePaymentOrderConsumablesOrder
  const order = item.ConsumablesOrder

  return {
    ...item,
    ConsumablesOrder: order
      ? {
          ...order,
          ConsumablesOrderItems: Array.isArray(order.ConsumablesOrderItems)
            ? order.ConsumablesOrderItems
                .filter((orderItem): orderItem is ConsumablesOrderItem => Boolean(orderItem && typeof orderItem === 'object'))
            : [],
        }
      : null,
  }
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

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}
