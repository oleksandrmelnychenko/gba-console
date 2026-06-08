import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getTaxFreePackListById, getTaxFreePackLists } from './taxFreePackListsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('taxFreePackListsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads pack lists from wrapped items payloads', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Items: [
          {
            NetUid: 'pack-list-1',
            TaxFrees: null,
            TaxFreePackListOrderItems: null,
          },
        ],
        Total: 12,
      },
    })

    const result = await getTaxFreePackLists({
      from: '2025-01-01',
      limit: 20,
      offset: 0,
      to: '2026-06-08',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/taxfree/all/filtered', {
      query: {
        from: '2025-01-01T00:00:00.000',
        limit: 20,
        offset: 0,
        to: '2026-06-08T23:59:59.999',
      },
    })
    expect(result.totalQty).toBe(12)
    expect(result.items).toEqual([
      expect.objectContaining({
        NetUid: 'pack-list-1',
        TaxFrees: [],
        TaxFreePackListOrderItems: [],
      }),
    ])
  })

  it('loads a pack-list detail from a wrapped body payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        NetUid: 'pack-list-2',
        TaxFrees: null,
      },
    })

    const result = await getTaxFreePackListById('pack-list-2')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/taxfree/get', {
      query: {
        netId: 'pack-list-2',
      },
    })
    expect(result).toEqual(expect.objectContaining({ NetUid: 'pack-list-2', TaxFrees: [] }))
  })
})
