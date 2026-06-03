import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { calculateAdvancedReportOrder, getAdvancedReports } from './advancedReportsApi'
import type { OutcomePaymentOrder } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('advancedReportsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('calculates an advanced report through the outcome calculate endpoint', async () => {
    const order: OutcomePaymentOrder = {
      Amount: 100,
      NetUid: 'order-1',
    }
    const calculatedOrder: OutcomePaymentOrder = {
      Amount: 125,
      NetUid: 'order-1',
      OutcomePaymentOrderConsumablesOrders: [
        {
          NetUid: 'link-1',
          ConsumablesOrder: {
            NetUid: 'consumable-1',
            ConsumablesOrderItems: [
              {
                NetUid: 'item-1',
                Qty: 2,
              },
              null as never,
            ],
          },
        },
      ],
    }

    apiRequestMock.mockResolvedValueOnce(calculatedOrder)

    const result = await calculateAdvancedReportOrder(order)

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/calculate', {
      body: order,
      method: 'POST',
    })
    expect(result?.Amount).toBe(125)
    expect(result?.OutcomePaymentOrderConsumablesOrders?.[0]?.ConsumablesOrder?.ConsumablesOrderItems).toHaveLength(1)
  })

  it('returns null when calculate response is empty', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(calculateAdvancedReportOrder({ NetUid: 'order-1' })).resolves.toBeNull()
  })

  it('keeps top-level total rows metadata from the under-report list response', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Collection: [
        {
          Amount: 10,
          NetUid: 'order-without-advance-number',
        },
      ],
      TotalRowsQty: 42,
    })

    const result = await getAdvancedReports({
      from: '2026-06-01',
      limit: 20,
      offset: 20,
      to: '2026-06-03',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/all/underreport', {
      query: {
        currencyNetId: undefined,
        from: '2026-06-01',
        limit: 20,
        offset: 20,
        paymentMovementNetId: undefined,
        registerNetId: undefined,
        to: '2026-06-03',
        value: undefined,
      },
    })
    expect(result.Collection).toHaveLength(1)
    expect(result.TotalRowsQty).toBe(42)
  })
})
