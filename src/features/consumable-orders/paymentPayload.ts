import type {
  ConsumablesOrder,
  ConsumablesOrderItem,
  Organization,
  OutcomePaymentOrder,
  PaymentCurrencyRegister,
  PaymentMovement,
  PaymentRegister,
} from './types'

export const MONEY_EPSILON = 0.005

export function buildPaymentPayload({
  amount,
  comment,
  date,
  order,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  time,
}: {
  amount: number
  comment: string
  date: string
  order: ConsumablesOrder
  selectedCurrencyRegister: PaymentCurrencyRegister
  selectedMovement: PaymentMovement
  selectedOrganization: Organization
  selectedRegister: PaymentRegister
  time: string
}): OutcomePaymentOrder {
  const paidOrder = {
    ...order,
    ConsumablesOrderItems: (order.ConsumablesOrderItems || []).map((item) => ({
      ...item,
      ConsumableProductOrganization: order.ConsumableProductOrganization,
    })),
    IsPayed: isPaymentCoveringOutstandingAmount(order, amount),
  }

  return {
    Amount: amount,
    Comment: comment.trim(),
    FromDate: toIsoDateTime(date, time),
    Organization: selectedOrganization,
    OutcomePaymentOrderConsumablesOrders: [
      {
        ConsumablesOrder: paidOrder,
      },
    ],
    PaymentCurrencyRegister: selectedCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: selectedMovement,
    },
    PaymentRegister: selectedRegister,
  }
}

export function calculateLocalTotal(items: ConsumablesOrderItem[]): number {
  return items.reduce((total, item) => total + (item.TotalPriceWithVAT || 0), 0)
}

export function getPaymentTotalAmount(order: ConsumablesOrder): number {
  return order.TotalAmount || calculateLocalTotal(order.ConsumablesOrderItems || [])
}

export function getPaidAmount(order: ConsumablesOrder): number {
  return order.TotalPaidAmount || 0
}

export function getRemainingPaymentAmount(order: ConsumablesOrder): number {
  return Math.max(getPaymentTotalAmount(order) - getPaidAmount(order), 0)
}

export function isPaymentCoveringOutstandingAmount(order: ConsumablesOrder, amount: number): boolean {
  return getPaidAmount(order) + amount >= getPaymentTotalAmount(order) - MONEY_EPSILON
}

function toIsoDateTime(dateValue: string, timeValue: string): string {
  const time = timeValue || '00:00'

  return new Date(`${dateValue}T${time}:00`).toISOString()
}
