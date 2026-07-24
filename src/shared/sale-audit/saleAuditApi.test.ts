import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/apiClient'
import { confirmSaleAuditHistory } from './saleAuditApi'

vi.mock('../api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('sale audit protocol mutation', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(null)
  })

  it('uses POST and preserves the durable retry key', async () => {
    const operationId =
      '11111111-1111-4111-8111-111111111111'
    const historyNetId =
      '22222222-2222-4222-8222-222222222222'

    await confirmSaleAuditHistory(
      { NetId: historyNetId, OperationNetUid: operationId },
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/protocol/act/invoice/set/edit/act/for/editing',
      {
        body: {
          NetId: historyNetId,
          OperationNetUid: operationId,
        },
        headers: { 'Idempotency-Key': operationId },
        method: 'POST',
      },
    )
  })
})
