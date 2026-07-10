import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { AI_FLEET_SERVICES, getAiFleetServicesSnapshot, getAiFleetServiceStatus, triggerAiFleetWarmup } from './aiFleetApi'

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

  it('keeps every procurement AI entry point in the fleet catalog', () => {
    const procurement = AI_FLEET_SERVICES.find((service) => service.id === 'procurement')

    expect(procurement?.location).toContain('/basket-supply-ukraine-order/budget-cart')
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

  it('keeps live API statuses and exposes a fleet telemetry failure', async () => {
    apiRequestMock.mockImplementation(async (path) => {
      if (path === '/ai/fleet/status') {
        throw new Error('503 from fleet status')
      }

      return { healthy: true }
    })

    const snapshot = await getAiFleetServicesSnapshot()

    expect(snapshot.telemetryError).toContain('503 from fleet status')
    expect(snapshot.statuses).toHaveLength(7)
    expect(snapshot.statuses.every((status) => status.health.state === 'healthy')).toBe(true)
    expect(snapshot.statuses.every((status) => status.warmup.state === 'unknown')).toBe(true)
    expect(snapshot.statuses[0].warmup.message).toContain('Статус 05:00 недоступний')
    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/products/intelligence/health',
      '/sales/prediction/health',
      '/sales/cockpit/health',
      '/procurement/health',
      '/solvency/health',
      '/recommendations/health',
      '/pricing/health',
      '/ai/fleet/status',
    ])
  })

  it('treats a malformed successful fleet response as a telemetry failure', async () => {
    apiRequestMock.mockImplementation(async (path) => (
      path === '/ai/fleet/status' ? {} : { healthy: true }
    ))

    const snapshot = await getAiFleetServicesSnapshot()

    expect(snapshot.telemetryError).toBe('Статус 05:00 повернув некоректну відповідь.')
    expect(snapshot.statuses.every((status) => status.health.state === 'healthy')).toBe(true)
    expect(snapshot.statuses.every((status) => status.warmup.state === 'unknown')).toBe(true)
  })

  it('treats a partial successful fleet response as a telemetry failure', async () => {
    apiRequestMock.mockImplementation(async (path) => (
      path === '/ai/fleet/status'
        ? {
            OperationState: 'healthy',
            Services: [{ ServiceId: 'nba', State: 'healthy' }],
          }
        : { healthy: true }
    ))

    const snapshot = await getAiFleetServicesSnapshot()

    expect(snapshot.telemetryError).toContain('немає сервісів')
    expect(snapshot.statuses.find((status) => status.serviceId === 'nba')?.warmup.state).toBe('healthy')
    expect(snapshot.statuses.find((status) => status.serviceId === 'products')?.warmup.state).toBe('unknown')
  })

  it('starts the scheduler AI warmup endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(triggerAiFleetWarmup()).resolves.toBeUndefined()
    expect(apiRequestMock).toHaveBeenCalledWith('/tasks/scheduler/ai/warmup')
  })
})
