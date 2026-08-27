import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createDepreciatedOrderFromFile,
  exportDepreciatedOrderDocument,
  getDepreciatedOrderByNetId,
  getDepreciatedOrderStorages,
  getDepreciatedOrders,
} from './depreciatedOrdersApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('depreciatedOrdersApi protected write-off routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue([])
  })

  it('uses only page, details, export, storage, and create façades', async () => {
    await getDepreciatedOrders({ from: '2026-08-01', limit: 20, offset: 0, to: '2026-08-19' })
    await getDepreciatedOrderByNetId('order-1')
    await getDepreciatedOrderStorages()
    await exportDepreciatedOrderDocument('order-1')
    await createDepreciatedOrderFromFile({
      file: new File(['xlsx'], 'write-off.xlsx'),
      parseConfiguration: {
        EndRow: 10,
        QtyColumnNumber: 2,
        StartRow: 2,
        VendorCodeColumnNumber: 1,
      },
      depreciatedOrder: {
        Comment: 'Причина',
        FromDate: '2026-08-19T10:00:00.000Z',
        IsManagement: false,
        Storage: { NetUid: 'storage-1' },
      },
    })

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/orders/depreciated/write-off/registry',
      '/orders/depreciated/write-off/details',
      '/storages/write-off/create/all',
      '/orders/depreciated/write-off/document/export',
      '/orders/depreciated/write-off/file/create',
    ])
    expect(apiRequestMock).toHaveBeenNthCalledWith(1, expect.any(String), {
      query: { from: '2026-08-01', limit: 20, offset: 0, to: '2026-08-19' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, expect.any(String), {
      query: { netId: 'order-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(4, expect.any(String), {
      query: { netId: 'order-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(5, expect.any(String), expect.objectContaining({
      body: expect.any(FormData),
      method: 'POST',
    }))
  })
})
