import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AdvancedReportsResponse,
  AdvancedReportsSearchParams,
  ConsumablesOrderItem,
  Currency,
  OutcomePaymentOrder,
  OutcomePaymentOrderConsumablesOrder,
  PaymentMovement,
  PaymentRegister,
} from '../types'

export async function getAdvancedReports(params: AdvancedReportsSearchParams): Promise<AdvancedReportsResponse> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/all/underreport', {
    query: {
      currencyNetId: params.currencyNetId || undefined,
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      paymentMovementNetId: params.paymentMovementNetId || undefined,
      registerNetId: params.registerNetId || undefined,
      to: params.to,
      value: params.value || undefined,
    },
  })

  return normalizeAdvancedReportsResponse(result)
}

export async function calculateAdvancedReportOrder(order: OutcomePaymentOrder): Promise<OutcomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/calculate', {
    body: order,
    method: 'POST',
  })

  return normalizeOutcomePaymentOrder(result)
}

export async function getAdvancedReportCurrencies(): Promise<Currency[]> {
  const result = await apiRequest<unknown>('/currencies/all')

  return readArrayPayload(result, ['Items', 'Currencies', 'Data']) as Currency[]
}

export async function getAdvancedReportPaymentMovements(): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all')

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function searchAdvancedReportPaymentRegisters(value = ''): Promise<PaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentRegisters', 'Data']) as PaymentRegister[]
}

function normalizeAdvancedReportsResponse(result: unknown): AdvancedReportsResponse {
  const payload = result && typeof result === 'object' && !Array.isArray(result)
    ? (result as Partial<AdvancedReportsResponse>)
    : {}

  const collection = readCollection(readArrayPayload(result, ['Collection', 'Items', 'OutcomePaymentOrders', 'Data']))

  return {
    Collection: collection,
    NegativeDifferenceAmount: readNumber(payload.NegativeDifferenceAmount),
    PositiveDifferenceAmount: readNumber(payload.PositiveDifferenceAmount),
    TotalRowsQty: readNumber(payload.TotalRowsQty) || readNumber(collection[0]?.TotalRowsQty),
  }
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
