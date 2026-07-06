import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReturnStorages, searchReturnProducts } from './salesReturnsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

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
})
