import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getVehicleRegistryVehicles } from './vehicleRegistryApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('vehicle registry API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requests GBA matches first and forwards the match filter', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [], Limit: 50, Offset: 0, Total: 0 })

    await getVehicleRegistryVehicles({
      clientMatchState: 'matched',
      limit: 50,
      offset: 0,
      prioritizeClientMatches: true,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/administration/vehicle-registry/vehicles', {
      query: {
        brand: '',
        clientMatchState: 'matched',
        dataQualityStatus: '',
        includeRemoved: false,
        limit: 50,
        model: '',
        offset: 0,
        prioritizeClientMatches: true,
        processingState: '',
        region: '',
        search: '',
        workflowStatus: '',
      },
      signal: undefined,
    })
  })
})
