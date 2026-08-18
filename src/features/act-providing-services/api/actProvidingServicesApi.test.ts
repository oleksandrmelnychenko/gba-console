import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getActProvidingServices,
  getProvidingServiceActLogisticWayDetails,
  getProvidingServiceActOverviewDetails,
  getProvidingServiceActsRegistry,
} from './actProvidingServicesApi'

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
        from: expect.stringContaining('T00:00:00.000'),
        isFiltered: true,
        limit: 3,
        offset: 0,
        to: expect.stringContaining('T23:59:59.999'),
      },
    })
  })

  it('uses separate canonical registry, overview and logistic-way routes', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [{ NetUid: 'act-1' }] })
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'act-1' })
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'act-1' })

    await getProvidingServiceActsRegistry({
      from: '2026-06-01',
      isFiltered: true,
      limit: 20,
      offset: 0,
      to: '2026-06-30',
    })
    await getProvidingServiceActOverviewDetails('act-1')
    await getProvidingServiceActLogisticWayDetails('act-1')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/act/providing/services/registry', {
      query: {
        from: expect.stringContaining('T00:00:00.000'),
        isFiltered: true,
        limit: 21,
        offset: 0,
        to: expect.stringContaining('T23:59:59.999'),
      },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/act/providing/services/overview/details', {
      query: { netId: 'act-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/act/providing/services/logistic-way/details', {
      query: { netId: 'act-1' },
    })
  })
})
