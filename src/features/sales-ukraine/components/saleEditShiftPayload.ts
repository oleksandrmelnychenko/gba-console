import {
  OrderItemShiftStatusType,
  type SalesUkraineOrderItem,
  type SalesUkraineOrderItemShiftStatus,
  type SalesUkraineSale,
} from '../types'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

export function hasShiftableQuantity(item: SalesUkraineOrderItem): boolean {
  return getPositiveQuantity(item.Qty) !== null
}

export function buildBulkShiftPayload(sale: SalesUkraineSale, target: 'bill' | 'store'): SalesUkraineSale {
  const shiftStatus = target === 'bill' ? OrderItemShiftStatusType.Bill : OrderItemShiftStatusType.Store
  const orderItems = (Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []).flatMap((item) => {
    const qty = getPositiveQuantity(item.Qty)

    if (qty === null) {
      return []
    }

    return [{
      ...item,
      ShiftStatuses: [
        {
          Id: 0,
          NetUid: EMPTY_GUID,
          Deleted: false,
          ShiftStatus: shiftStatus as SalesUkraineOrderItemShiftStatus['ShiftStatus'],
          Qty: qty,
          OrderItemId: item.Id,
        },
      ],
    }]
  })

  return {
    ...sale,
    Order: {
      ...sale.Order,
      OrderItems: orderItems,
    },
  }
}

function getPositiveQuantity(value: unknown): number | null {
  const qty = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(qty) && qty > 0 ? qty : null
}
