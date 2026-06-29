import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { DailyDataSyncStockMode, SyncProductConsignmentType } from '../types'
import { startDailySync } from './syncApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('sync API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('starts daily sync with selected checkbox types in query params', async () => {
    const from = new Date(2026, 5, 24, 0, 1)
    const to = new Date(2026, 5, 24, 23, 59)
    const types = [
      String(SyncProductConsignmentType.Order),
      String(SyncProductConsignmentType.Sales),
      String(SyncProductConsignmentType.InternalMovementOfFunds),
    ]

    apiRequestMock.mockResolvedValueOnce({ Message: 'Синхронізацію запущено' })

    await expect(
      startDailySync({
        forAmg: true,
        from,
        stockMode: DailyDataSyncStockMode.DocumentsOnly,
        to,
        types,
      }),
    ).resolves.toEqual({
      Message: 'Синхронізацію запущено',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/data/sync/start/daily', {
      query: {
        forAmg: true,
        from,
        stockMode: DailyDataSyncStockMode.DocumentsOnly,
        to,
        types,
      },
      errorMessages: {
        default: 'Не вдалося запустити щоденну синхронізацію',
        network: 'Сервер синхронізації недоступний',
      },
    })
  })
})
