import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getAiFleetServiceStatus } from './aiFleetApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    status = 500
  },
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('aiFleetApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads one service health and merges the 05:00 warmup status', async () => {
    apiRequestMock
      .mockResolvedValueOnce({ healthy: true })
      .mockResolvedValueOnce({
        Services: [
          {
            Message: 'Задачі продажів сформовано',
            ServiceId: 'nba',
            State: 'success',
          },
        ],
      })

    await expect(getAiFleetServiceStatus('nba')).resolves.toEqual({
      health: { state: 'healthy' },
      serviceId: 'nba',
      warmup: {
        message: 'Задачі продажів сформовано',
        state: 'healthy',
      },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/sales/cockpit/health',
      expect.objectContaining({
        errorMessages: expect.any(Object),
      }),
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/ai/fleet/status', { signal: undefined })
  })

  it('returns null for an unknown service without network calls', async () => {
    await expect(getAiFleetServiceStatus('missing')).resolves.toBeNull()
    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
