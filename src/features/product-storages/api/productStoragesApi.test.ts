import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getAvailableProductsByStorage } from './productStoragesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('productStoragesApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads current storage availability without date filters', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Items: [
        {
          Amount: '4',
          Product: { VendorCode: 'PR-1' },
          TotalRowsQty: '12',
        },
      ],
      TotalRowsQty: '12',
    })

    await expect(getAvailableProductsByStorage({
      from: '2026-06-01',
      limit: 20,
      offset: 40,
      storageNetId: 'storage-net-id',
      to: '2026-06-30',
      value: ' PR-1 ',
    })).resolves.toEqual({
      items: [
        {
          Amount: 4,
          Product: { ProductPlacements: [], VendorCode: 'PR-1' },
          Placements: [],
          TotalRowsQty: 12,
        },
      ],
      totalQty: 12,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/storages/all/available/filtered', {
      query: {
        limit: 20,
        netId: 'storage-net-id',
        offset: 40,
        value: 'PR-1',
      },
    })
  })
})
