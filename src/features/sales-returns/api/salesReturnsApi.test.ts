import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  cancelSaleReturn,
  createDirectSaleReturn,
  createSaleReturn,
  getReturnStorages,
  searchReturnProducts,
} from './salesReturnsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const operationId = '11111111-1111-4111-8111-111111111111'

describe('sales returns API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('searches return products with the active product lookup mode and supports Collection payloads', async () => {
    const products = [{ NetUid: 'product-1', VendorCode: 'CR0017-SF' }]

    apiRequestMock.mockResolvedValueOnce({ Collection: products })

    await expect(searchReturnProducts(' CR0017-SF ')).resolves.toEqual(products)

    expect(apiRequestMock).toHaveBeenCalledWith('/products/search/advanced', {
      query: {
        limit: 10,
        mode: 5,
        netId: '00000000-0000-0000-0000-000000000000',
        offset: 0,
        sortMode: 2,
        value: 'CR0017-SF',
      },
    })
  })

  it('requests return storages by order item, organization, and selected reason', async () => {
    const storages = [{ Id: 1, Name: 'Склад' }]

    apiRequestMock.mockResolvedValueOnce({ Items: storages })

    await expect(
      getReturnStorages({
        orderItemNetId: 'order-item-1',
        organizationNetId: 'organization-1',
        status: 6,
      }),
    ).resolves.toEqual(storages)

    expect(apiRequestMock).toHaveBeenCalledWith('/storages/all/returns/filtered', {
      query: {
        orderItemNetId: 'order-item-1',
        organizationNetId: 'organization-1',
        status: 6,
      },
    })
  })

  it('sends the durable operation key when creating a sale return', async () => {
    const payload = {
      Client: { Id: 10 },
      SaleReturnItems: [],
    }

    apiRequestMock.mockResolvedValueOnce({ Id: 42 })

    await createSaleReturn(payload, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/returns/new', {
      body: payload,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
    })
  })

  it('does not send the obsolete direct-return payload to the canonical endpoint', async () => {
    const payload = {
      ClientAgreementId: 12,
      ClientId: 10,
      Products: [],
      StorageId: 3,
    }

    await expect(
      createDirectSaleReturn(payload, { operationId }),
    ).rejects.toThrow(
      'Пряме повернення за партією не має серверного контракту',
    )
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('sends the durable operation key when canceling a return', async () => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'return-1' })

    await cancelSaleReturn('return-1', { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/returns/cancel', {
      headers: { 'Idempotency-Key': operationId },
      method: 'PUT',
      query: { netId: 'return-1' },
    })
  })
})
