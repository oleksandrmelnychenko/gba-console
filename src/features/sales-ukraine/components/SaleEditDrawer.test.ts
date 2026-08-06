import { describe, expect, it } from 'vitest'
import type { SalesUkraineSale } from '../types'
import { OrderItemShiftStatusType } from '../types'
import { buildBulkShiftPayload } from './saleEditShiftPayload'

describe('SaleEditDrawer bulk shift payload', () => {
  it.each([
    ['bill', OrderItemShiftStatusType.Bill],
    ['store', OrderItemShiftStatusType.Store],
  ] as const)('sends only positive rows for the %s action', (target, shiftStatus) => {
    const sale: SalesUkraineSale = {
      NetUid: 'sale-1',
      Order: {
        OrderItems: [
          { Id: 11, NetUid: 'item-positive', Qty: 3 },
          { Id: 12, NetUid: 'item-zero', Qty: 0 },
          { Id: 13, NetUid: 'item-negative', Qty: -1 },
        ],
      },
    }

    const payload = buildBulkShiftPayload(sale, target)

    expect(payload.Order?.OrderItems).toEqual([
      expect.objectContaining({
        Id: 11,
        ShiftStatuses: [
          expect.objectContaining({
            Id: 0,
            OrderItemId: 11,
            Qty: 3,
            ShiftStatus: shiftStatus,
          }),
        ],
      }),
    ])
  })
})
