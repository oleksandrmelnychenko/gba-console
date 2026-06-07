import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getActProvidingServices } from './actProvidingServicesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('actProvidingServicesApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('reads collection-shaped responses and keeps client-side has-more detection', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Collection: [
        { NetUid: 'act-1', Number: '0000000001' },
        { NetUid: 'act-2', Number: '0000000002' },
        { NetUid: 'act-3', Number: '0000000003' },
      ],
    })

    await expect(getActProvidingServices({
      from: '2026-06-01',
      isFiltered: true,
      limit: 2,
      offset: 0,
      to: '2026-06-30',
    })).resolves.toEqual({
      HasMore: true,
      Items: [
        { NetUid: 'act-1', Number: '0000000001' },
        { NetUid: 'act-2', Number: '0000000002' },
      ],
      Total: undefined,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/act/providing/services/all', {
      query: {
        from: '2026-06-01',
        isFiltered: true,
        limit: 3,
        offset: 0,
        to: '2026-06-30',
      },
    })
  })
})
