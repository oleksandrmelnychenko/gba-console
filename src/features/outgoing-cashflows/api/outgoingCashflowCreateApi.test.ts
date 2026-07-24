import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createOutgoingCashflowOrder } from './outgoingCashflowCreateApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('outgoingCashflowCreateApi mutation contract', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('sends a stable explicit idempotency key with the immutable JSON body', async () => {
    const operationId = '66666666-6666-4666-8666-666666666666'
    const order = {
      Amount: 450,
      Comment: 'Оплата постачальнику',
    }
    apiRequestMock.mockResolvedValueOnce({
      ...order,
      NetUid: 'outcome-1',
    })

    await createOutgoingCashflowOrder(order, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/new', {
      body: order,
      dedupe: false,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
    })
  })
})
