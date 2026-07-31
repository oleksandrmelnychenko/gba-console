import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getVehicleRegistryImportTotal,
  getVehicleRegistryVehicles,
} from './vehicleRegistryApi'

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

  it('loads the import total without waiting for the imports tab', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Items: [],
      Limit: 1,
      Offset: 0,
      Total: 5,
    })

    await expect(getVehicleRegistryImportTotal()).resolves.toBe(5)
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/administration/vehicle-registry/imports',
      {
        query: { limit: 1, offset: 0 },
        signal: undefined,
      },
    )
  })
})
