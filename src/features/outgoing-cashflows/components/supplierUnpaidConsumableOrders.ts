import type { ConsumablesOrder } from '../../consumable-orders/types'
import { getRemainingPaymentAmount } from '../../consumable-orders/paymentPayload'
import { moneyFormatter } from './outgoingModeShared'

const dateFormatter = new Intl.DateTimeFormat('uk-UA')

export function getConsumableOrderSelectionValue(order: ConsumablesOrder): string {
  return String(order.NetUid || order.Id || '')
}

export function getSelectedConsumableOrders(orders: ConsumablesOrder[], values: string[]): ConsumablesOrder[] {
  const selectedValues = new Set(values)

  return orders.filter((order) => selectedValues.has(getConsumableOrderSelectionValue(order)))
}

export function getConsumableOrdersRemainingAmount(orders: ConsumablesOrder[]): number {
  return orders.reduce((total, order) => total + getRemainingPaymentAmount(order), 0)
}

export function getConsumableOrderPaymentLabel(order: ConsumablesOrder): string {
  const number = order.OrganizationNumber || order.Number || getConsumableOrderSelectionValue(order)
  const date = formatOrderDate(order.OrganizationFromDate || order.Created)
  const amount = moneyFormatter.format(getRemainingPaymentAmount(order))

  return [number, date, amount].filter(Boolean).join(' · ')
}

function formatOrderDate(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}
