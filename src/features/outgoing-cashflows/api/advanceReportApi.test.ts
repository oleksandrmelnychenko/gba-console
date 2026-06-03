import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { calculateAdvanceReportOrder, updateAdvanceReportOrder } from './advanceReportApi'
import type { AdvanceReportOrder } from '../advanceReportTypes'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('advanceReportApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('strips UI-only local NetUid values before calculating an advance report', async () => {
    const order = createOrderWithLocalNetUids()

    apiRequestMock.mockResolvedValueOnce({ Amount: 120, NetUid: 'order-1' })

    await calculateAdvanceReportOrder(order)

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/calculate', {
      body: expect.objectContaining({
        CompanyCarFuelings: [
          expect.not.objectContaining({ NetUid: 'local-fueling' }),
        ],
        NetUid: 'order-1',
        OutcomePaymentOrderConsumablesOrders: [
          expect.objectContaining({
            ConsumablesOrder: expect.objectContaining({
              ConsumablesOrderItems: [
                expect.not.objectContaining({ NetUid: 'local-item' }),
              ],
              NetUid: 'consumable-order-1',
            }),
          }),
        ],
      }),
      method: 'POST',
    })
    expect(order.OutcomePaymentOrderConsumablesOrders?.[0]?.NetUid).toBe('local-entry')
    expect(order.CompanyCarFuelings?.[0]?.NetUid).toBe('local-fueling')
  })

  it('strips UI-only local NetUid values from multipart update payloads', async () => {
    const order = createOrderWithLocalNetUids()
    const document = new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' })

    apiRequestMock.mockResolvedValueOnce({ NetUid: 'order-1' })

    await updateAdvanceReportOrder(true, order, [document])

    const [, options] = apiRequestMock.mock.calls[0]
    const body = options?.body as FormData
    const payload = JSON.parse(String(body.get('order'))) as AdvanceReportOrder

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/orders/outcome/upload/update',
      expect.objectContaining({
        method: 'POST',
        query: { auto: true },
      }),
    )
    expect(body.getAll('documents')).toEqual([document])
    expect(payload.OutcomePaymentOrderConsumablesOrders?.[0]?.NetUid).toBeUndefined()
    expect(payload.OutcomePaymentOrderConsumablesOrders?.[0]?.ConsumablesOrder?.NetUid).toBe('consumable-order-1')
    expect(payload.OutcomePaymentOrderConsumablesOrders?.[0]?.ConsumablesOrder?.ConsumablesOrderItems?.[0]?.NetUid)
      .toBeUndefined()
    expect(payload.CompanyCarFuelings?.[0]?.NetUid).toBeUndefined()
  })
})

function createOrderWithLocalNetUids(): AdvanceReportOrder {
  return {
    Amount: 100,
    CompanyCarFuelings: [
      {
        FuelAmount: 10,
        NetUid: 'local-fueling',
      },
    ],
    NetUid: 'order-1',
    OutcomePaymentOrderConsumablesOrders: [
      {
        ConsumablesOrder: {
          ConsumablesOrderItems: [
            {
              NetUid: 'local-item',
              Qty: 2,
            },
          ],
          NetUid: 'consumable-order-1',
        },
        NetUid: 'local-entry',
      },
    ],
  }
}
