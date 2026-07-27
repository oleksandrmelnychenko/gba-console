import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  cancelOutgoingCashflow,
  getOutgoingCashflowByNetId,
  getOutgoingCashflows,
} from './outgoingCashflowsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('outgoingCashflowsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('uses the canonical TotalRowsQty contract', async () => {
    apiRequestMock.mockResolvedValueOnce({
      OutcomePaymentOrders: [
        {
          NetUid: 'order-1',
          TotalRowsQty: 45,
        },
      ],
    })

    await expect(getOutgoingCashflows({
      from: '2026-06-01',
      limit: 20,
      offset: 0,
      to: '2026-06-08',
    })).resolves.toMatchObject({
      Collection: [{ NetUid: 'order-1', TotalRowsQty: 45 }],
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

  it('sends the idempotency key when canceling an outcome order', async () => {
    const operationId = '55555555-5555-4555-8555-555555555555'
    apiRequestMock.mockResolvedValueOnce({
      Entity: {
        NetUid: 'outcome-order-1',
      },
    })

    await cancelOutgoingCashflow('outcome-order-1', { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/cancel', {
      dedupe: false,
      headers: { 'Idempotency-Key': operationId },
      method: 'PUT',
      query: {
        netId: 'outcome-order-1',
      },
    })
  })
})
