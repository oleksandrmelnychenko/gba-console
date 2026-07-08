import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getAiFleetServiceStatus, triggerAiFleetWarmup } from './aiFleetApi'

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
        GeneratedAtUtc: '2026-07-08T05:05:00Z',
        LastFinishedAtUtc: '2026-07-08T05:04:00Z',
        LastStartedAtUtc: '2026-07-08T05:00:00Z',
        LogFilePath: '/app/Logs/ai_warmup_log.txt',
        OperationState: 'healthy',
        Services: [
          {
            LastFinishedAtUtc: '2026-07-08T05:04:00Z',
            LastStartedAtUtc: '2026-07-08T05:00:00Z',
            Message: 'Задачі продажів сформовано',
            ServiceId: 'nba',
            Source: 'GbaNbaApi',
            State: 'success',
          },
        ],
      })

    await expect(getAiFleetServiceStatus('nba')).resolves.toEqual({
      health: { state: 'healthy' },
      operation: {
        generatedAtUtc: '2026-07-08T05:05:00Z',
        lastFinishedAtUtc: '2026-07-08T05:04:00Z',
        lastStartedAtUtc: '2026-07-08T05:00:00Z',
        logFilePath: '/app/Logs/ai_warmup_log.txt',
        state: 'healthy',
      },
      serviceId: 'nba',
      warmup: {
        lastFinishedAtUtc: '2026-07-08T05:04:00Z',
        lastStartedAtUtc: '2026-07-08T05:00:00Z',
        message: 'Задачі продажів сформовано',
        source: 'GbaNbaApi',
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

  it('starts the scheduler AI warmup endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(triggerAiFleetWarmup()).resolves.toBeUndefined()
    expect(apiRequestMock).toHaveBeenCalledWith('/tasks/scheduler/ai/warmup')
  })
})
