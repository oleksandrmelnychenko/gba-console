import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  exportProductPlacements,
  exportReturnedProductPlacements,
  getProductPlacements,
  getProductPlacementStorages,
  submitReturnedProductPlacements,
  uploadProductPlacementFile,
} from './productPlacementsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('product placements permission-scoped API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads storages and registry only through page-scoped routes', async () => {
    apiRequestMock.mockResolvedValueOnce([]).mockResolvedValueOnce({ Items: [] })

    await getProductPlacementStorages()
    await getProductPlacements({
      limit: 20,
      offset: 0,
      storageIds: [7],
      to: '2026-08-19T23:59:59.999Z',
      value: 'ABC',
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/storages/product-placements/page/nondefective')
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/products/placements/storage/page/registry', {
      query: {
        limit: 20,
        offset: 0,
        storageId: [7],
        to: '2026-08-19T23:59:59.999Z',
        value: 'ABC',
      },
    })
  })

  it('uses the independent document routes and sends only the narrow returned-row contract', async () => {
    apiRequestMock.mockResolvedValue({})

    await exportProductPlacements()
    await exportReturnedProductPlacements([{
      Created: 'untrusted',
      ErrorMessage: 'not sent',
      Id: 99,
      Placement: ' A-1-2 ',
      Product: {
        Id: 88,
        Name: ' Product ',
        NetUid: '11111111-1111-4111-8111-111111111111',
        VendorCode: 'IGNORED',
      },
      Qty: 3,
      Storage: { Id: 7, Name: 'Storage' },
      StorageId: 7,
      VendorCode: ' ABC ',
    }])

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/products/placements/storage/page/document/export')
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/products/placements/storage/page/document/returned/export', {
      body: [{
        placement: 'A-1-2',
        productName: 'Product',
        qty: 3,
        vendorCode: 'ABC',
      }],
      method: 'POST',
    })
  })

  it('uses import-scoped routes and keeps the correction payload narrow', async () => {
    apiRequestMock.mockResolvedValue({})
    const formData = new FormData()
    formData.append('file', new File(['sheet'], 'placements.xlsx'))

    await uploadProductPlacementFile(formData)
    await submitReturnedProductPlacements({
      items: [{ placement: 'A-1-2', qty: 2, vendorCode: 'ABC' }],
      storageId: 7,
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/products/placements/storage/page/import/file', {
      body: formData,
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/products/placements/storage/page/import/return', {
      body: {
        items: [{ placement: 'A-1-2', qty: 2, vendorCode: 'ABC' }],
        storageId: 7,
      },
      method: 'POST',
    })
  })
})
