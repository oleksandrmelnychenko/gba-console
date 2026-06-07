import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getSupplyOrderUkraineById } from './orderPlacementsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('orderPlacementsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('deep-normalizes dynamic placement arrays', async () => {
    apiRequestMock.mockResolvedValueOnce({
      NetUid: 'order-1',
      DynamicProductPlacementColumns: [
        { Id: 1 },
        {
          Id: 2,
          DynamicProductPlacementRows: [
            { Id: 10 },
            { Id: 11, DynamicProductPlacements: [{ Id: 100 }] },
          ],
        },
      ],
    })

    await expect(getSupplyOrderUkraineById('order-1')).resolves.toEqual({
      NetUid: 'order-1',
      SupplyOrderUkraineItems: [],
      DynamicProductPlacementColumns: [
        { Id: 1, DynamicProductPlacementRows: [] },
        {
          Id: 2,
          DynamicProductPlacementRows: [
            { Id: 10, DynamicProductPlacements: [] },
            { Id: 11, DynamicProductPlacements: [{ Id: 100 }] },
          ],
        },
      ],
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/get', {
      query: { netId: 'order-1' },
    })
  })
})
