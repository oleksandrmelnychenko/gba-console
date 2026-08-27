import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  approveEditingAct,
  approveEditingCarrier,
} from './editingApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('protocol invoice-edit mutation contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(null)
  })

  it('posts an invoice edit with the same durable key in body and header', async () => {
    const operationId =
      '11111111-1111-4111-8111-111111111111'
    const historyNetId =
      '22222222-2222-4222-8222-222222222222'

    await approveEditingAct(
      { NetId: historyNetId, OperationNetUid: operationId },
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/protocol/act/invoice/warehouse-ukraine/process-act',
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

  it('posts a carrier edit with the same durable key in body and header', async () => {
    const operationId =
      '33333333-3333-4333-8333-333333333333'
    const historyNetId =
      '44444444-4444-4444-8444-444444444444'

    await approveEditingCarrier(
      { NetId: historyNetId, OperationNetUid: operationId },
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/protocol/act/invoice/warehouse-ukraine/process-carrier',
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

  it('rejects an invalid history identity before network I/O', async () => {
    const operationId =
      '55555555-5555-4555-8555-555555555555'

    await expect(approveEditingAct(
      { NetId: 'not-a-guid', OperationNetUid: operationId },
      { operationId },
    )).rejects.toThrow('Не вдалося визначити акт')

    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
