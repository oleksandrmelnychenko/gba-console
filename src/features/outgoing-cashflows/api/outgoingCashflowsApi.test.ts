import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getOutgoingCashflowByNetId, getOutgoingCashflows } from './outgoingCashflowsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('outgoingCashflowsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('uses legacy TotalQty when TotalRowsQty is not returned', async () => {
    apiRequestMock.mockResolvedValueOnce({
      OutcomePaymentOrders: [
        {
          NetUid: 'order-1',
          TotalQty: 45,
        },
      ],
    })

    await expect(getOutgoingCashflows({
      from: '2026-06-01',
      limit: 20,
      offset: 0,
      to: '2026-06-08',
    })).resolves.toMatchObject({
      Collection: [{ NetUid: 'order-1', TotalQty: 45 }],
      TotalRowsQty: 45,
    })
  })

  it('loads a focused outcome payment order by NetUid for cash-flow drilldown', async () => {
    apiRequestMock.mockResolvedValueOnce({
      NetUid: 'outcome-order-1',
      Number: 'ВКО-1',
      OutcomePaymentOrderConsumablesOrders: null,
    })

    await expect(getOutgoingCashflowByNetId('outcome-order-1')).resolves.toEqual({
      NetUid: 'outcome-order-1',
      Number: 'ВКО-1',
      OutcomePaymentOrderConsumablesOrders: [],
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/get', {
      query: {
        netId: 'outcome-order-1',
      },
    })
  })
})
