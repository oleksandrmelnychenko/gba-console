import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getTaxFreeCarrier, getTaxFreeDocuments } from './taxFreeDocumentsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('taxFreeDocumentsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads tax free documents from wrapped collection payloads', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Collection: [
          {
            NetUid: 'tax-free-1',
            TaxFreeItems: null,
          },
        ],
        TotalRowsQty: 5,
      },
    })

    const result = await getTaxFreeDocuments({
      from: '2025-01-01',
      limit: 21,
      offset: 0,
      status: '',
      stathamNetId: '',
      to: '2026-06-08',
      value: '',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/taxfree/all/filtered', {
      query: {
        from: '2025-01-01T00:00:00.000',
        limit: 21,
        offset: 0,
        status: '',
        stathamNetId: '',
        to: '2026-06-08T23:59:59.999',
        value: '',
      },
    })
    expect(result.Total).toBe(5)
    expect(result.Items).toEqual([
      expect.objectContaining({
        NetUid: 'tax-free-1',
        TaxFreeItems: [],
      }),
    ])
  })

  it('loads a carrier from a wrapped body payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        NetUid: 'carrier-1',
        LastName: 'Driver',
      },
    })

    const result = await getTaxFreeCarrier('carrier-1')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/carriers/statham/get', {
      query: {
        netId: 'carrier-1',
      },
    })
    expect(result).toEqual({ NetUid: 'carrier-1', LastName: 'Driver' })
  })
})
