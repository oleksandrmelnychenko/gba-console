import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  exportGroupedProductRemains,
  exportProductRemains,
  getGroupedProductRemains,
  getProductRemainMovements,
  getProductRemainStorages,
  getProductRemainSuppliers,
  getProductRemains,
} from './productRemainsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('productRemainsApi protected consignment-balance routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue({ Collection: [] })
  })

  it('uses only scoped page, movement and export façades', async () => {
    await getProductRemainStorages()
    await getProductRemainSuppliers({ limit: 20, offset: 0, value: ' supplier ' })
    await getGroupedProductRemains({
      from: '2026-08-01',
      includeItems: false,
      limit: 25,
      offset: 0,
      storageNetIds: ['storage-1'],
      supplierNetId: 'supplier-1',
      to: '2026-08-19',
    })
    await getProductRemains({
      from: '2026-08-01',
      limit: 25,
      offset: 25,
      searchValue: ' product ',
      storageNetIds: ['storage-1'],
      supplierNetId: 'supplier-1',
      to: '2026-08-19',
    })
    await getProductRemainMovements({
      consignmentItemNetId: 'item-1',
      from: '2026-08-01',
      to: '2026-08-19',
    })
    await exportGroupedProductRemains({
      from: '2026-08-01',
      storageNetIds: ['storage-1'],
      supplierNetId: 'supplier-1',
      to: '2026-08-19',
    })
    await exportProductRemains({
      from: '2026-08-01',
      searchValue: ' product ',
      storageNetIds: ['storage-1'],
      supplierNetId: 'supplier-1',
      to: '2026-08-19',
    })

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/storages/consignment-balances/page/all',
      '/clients/suppliers/consignment-balances/all/filtered',
      '/consignments/remaining/consignment-balances/grouped/storage/filtered',
      '/consignments/remaining/consignment-balances/all/storage/filtered',
      '/consignments/info/consignment-balances/movement/specific',
      '/consignments/remaining/consignment-balances/grouped/storage/document/export',
      '/consignments/remaining/consignment-balances/document/export',
    ])
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({
      query: expect.objectContaining({ value: 'supplier' }),
    }))
    expect(apiRequestMock).toHaveBeenNthCalledWith(5, expect.any(String), expect.objectContaining({
      query: { consignmentItemNetId: 'item-1', from: '2026-08-01', to: '2026-08-19' },
    }))
  })
})
