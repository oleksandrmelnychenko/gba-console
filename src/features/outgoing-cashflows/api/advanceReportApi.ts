import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AdvanceReportConsumablesOrder,
  AdvanceReportConsumablesOrderItem,
  AdvanceReportOrder,
  AdvanceReportOutcomePaymentOrderConsumablesOrder,
  CompanyCarFueling,
} from '../advanceReportTypes'

export async function getAdvanceReportOrder(netId: string): Promise<AdvanceReportOrder | null> {
  const result = await apiRequest<unknown>(`/payments/orders/outcome/get?netId=${encodeURIComponent(netId)}`)

  return normalizeAdvanceReportOrder(result)
}

export async function calculateAdvanceReportOrder(order: AdvanceReportOrder): Promise<AdvanceReportOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/calculate', {
    body: order,
    method: 'POST',
  })

  return normalizeAdvanceReportOrder(result)
}

export async function updateAdvanceReportOrder(
  createIncomeAutomatically: boolean,
  order: AdvanceReportOrder,
): Promise<AdvanceReportOrder | null> {
  const result = await apiRequest<unknown>(`/payments/orders/outcome/update?auto=${createIncomeAutomatically}`, {
    body: order,
    method: 'POST',
  })

  return normalizeAdvanceReportOrder(result)
}

function normalizeAdvanceReportOrder(result: unknown): AdvanceReportOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as AdvanceReportOrder

  return {
    ...order,
    CompanyCarFuelings: Array.isArray(order.CompanyCarFuelings)
      ? order.CompanyCarFuelings.filter((item): item is CompanyCarFueling => Boolean(item && typeof item === 'object'))
      : [],
    OutcomePaymentOrderConsumablesOrders: Array.isArray(order.OutcomePaymentOrderConsumablesOrders)
      ? order.OutcomePaymentOrderConsumablesOrders
          .map(normalizeConsumablesOrder)
          .filter((item): item is AdvanceReportOutcomePaymentOrderConsumablesOrder => Boolean(item))
      : [],
  }
}

function normalizeConsumablesOrder(
  result: unknown,
): AdvanceReportOutcomePaymentOrderConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const item = result as AdvanceReportOutcomePaymentOrderConsumablesOrder
  const order = item.ConsumablesOrder

  return {
    ...item,
    ConsumablesOrder: order
      ? ({
          ...order,
          ConsumablesOrderItems: Array.isArray(order.ConsumablesOrderItems)
            ? order.ConsumablesOrderItems.filter(
                (orderItem): orderItem is AdvanceReportConsumablesOrderItem =>
                  Boolean(orderItem && typeof orderItem === 'object'),
              )
            : [],
        } as AdvanceReportConsumablesOrder)
      : null,
  }
}
