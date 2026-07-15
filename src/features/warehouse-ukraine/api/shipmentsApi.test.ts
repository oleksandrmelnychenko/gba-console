import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  updateDeliveryRecipient,
  updateDeliveryRecipientAddress,
  updateSaleComment,
} from './shipmentsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('shipment sale mutation contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(null)
  })

  it('uses one operation id in comment body and header', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'

    await updateSaleComment('sale-1', 'comment', { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/update/comment', {
      body: { Comment: 'comment', NetUid: 'sale-1', OperationNetUid: operationId },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: { netId: 'sale-1' },
    })
  })

  it('uses one operation id in recipient body and header', async () => {
    const operationId = '22222222-2222-4222-8222-222222222222'

    await updateDeliveryRecipient('sale-1', { FullName: 'Recipient', SaleNetId: 'sale-1' }, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/update/recipient', {
      body: { FullName: 'Recipient', OperationNetUid: operationId, SaleNetId: 'sale-1' },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: { netId: 'sale-1' },
    })
  })

  it('uses one operation id in recipient-address body and header', async () => {
    const operationId = '33333333-3333-4333-8333-333333333333'

    await updateDeliveryRecipientAddress('sale-1', { City: 'Kyiv', SaleNetId: 'sale-1' }, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/update/recipient/address', {
      body: { City: 'Kyiv', OperationNetUid: operationId, SaleNetId: 'sale-1' },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: { netId: 'sale-1' },
    })
  })
})
