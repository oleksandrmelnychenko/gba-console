import type { OutcomePaymentOrder, OutcomePaymentOrderConsumablesOrder } from './types'

/**
 * N3-04: an order paid from Платежі is linked to the invoice through its payment task
 * (OutcomePaymentOrderSupplyPaymentTasks -> SupplyPaymentTask -> ConsumablesOrder), not through
 * OutcomePaymentOrderConsumablesOrders, so «Пов’язані документи» stayed empty.
 */
export function getPaymentTaskConsumablesOrders(
  order?: OutcomePaymentOrder | null,
): OutcomePaymentOrderConsumablesOrder[] {
  return (order?.OutcomePaymentOrderSupplyPaymentTasks || [])
    .filter((item) => !item.Deleted && item.SupplyPaymentTask?.ConsumablesOrder && !item.SupplyPaymentTask.ConsumablesOrder.Deleted)
    .map((item) => ({
      Id: item.Id,
      NetUid: item.NetUid,
      ConsumablesOrder: item.SupplyPaymentTask?.ConsumablesOrder,
    }))
}

/** Whether the details read can add payment-task documents the registry row does not carry. */
export function mayHavePaymentTaskDocuments(order?: OutcomePaymentOrder | null): boolean {
  return Boolean(
    order?.NetUid
    && !order.IsUnderReport
    && !(order.OutcomePaymentOrderConsumablesOrders || []).some((item) => !item.Deleted && item.ConsumablesOrder),
  )
}
