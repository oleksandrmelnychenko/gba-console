import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getOutgoingCashflows } from './outgoingCashflowsApi'

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
})
