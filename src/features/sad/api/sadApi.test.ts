import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getSad, getSads } from './sadApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('sadApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads SAD rows from wrapped rows payloads', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Rows: [
          {
            NetUid: 'sad-1',
            SadItems: null,
            SadPallets: [{ NetUid: 'pallet-1', SadPalletItems: null }],
            Sales: null,
          },
        ],
      },
    })

    const result = await getSads({
      from: '2025-01-01',
      limit: 20,
      offset: 0,
      to: '2026-06-08',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/sad/all/filtered', {
      query: {
        from: '2025-01-01T00:00:00.000',
        limit: 20,
        offset: 0,
        to: '2026-06-08T23:59:59.999',
      },
    })
    expect(result).toEqual([
      expect.objectContaining({
        NetUid: 'sad-1',
        SadItems: [],
        SadPallets: [expect.objectContaining({ NetUid: 'pallet-1', SadPalletItems: [] })],
        Sales: [],
      }),
    ])
  })

  it('loads SAD detail from a wrapped body payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        NetUid: 'sad-2',
        SadDocuments: null,
      },
    })

    const result = await getSad('sad-2')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/sad/get', {
      query: {
        netId: 'sad-2',
      },
    })
    expect(result).toEqual(expect.objectContaining({ NetUid: 'sad-2', SadDocuments: [] }))
  })
})
