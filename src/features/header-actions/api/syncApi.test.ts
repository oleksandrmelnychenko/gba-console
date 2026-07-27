import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  DailyDataSyncStockMode,
  DataSyncSessionMode,
  SyncEntityType,
  SyncProductConsignmentType,
} from '../types'
import {
  createSyncOperationId,
  getSyncStatus,
  startDailySync,
  startFullSync,
  startSyncSession,
} from './syncApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('sync API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads the single server-side sync session', async () => {
    apiRequestMock.mockResolvedValueOnce({ IsInProgress: false })

    await expect(getSyncStatus()).resolves.toEqual({ IsInProgress: false })

    expect(apiRequestMock).toHaveBeenCalledWith('/data/sync/status', {
      errorMessages: {
        default: 'Не вдалося отримати статус синхронізації',
        network: 'Сервер синхронізації недоступний',
      },
    })
  })

  it('starts full sync with a stable operation id header', async () => {
    const operationId = '1234567890abcdef1234567890abcdef'
    const types = [String(SyncEntityType.Products), String(SyncEntityType.Clients)]
    apiRequestMock.mockResolvedValueOnce({ PipelineRunId: operationId })

    await startFullSync({
      forAmg: false,
      operationId,
      types,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/data/sync/start', {
      headers: {
        'X-GBA-Sync-Operation-Id': operationId,
      },
      method: 'POST',
      query: {
        forAmg: false,
        types,
      },
      errorMessages: {
        default: 'Не вдалося запустити синхронізацію з 1С',
        network: 'Сервер синхронізації недоступний',
      },
    })
  })

  it('starts daily sync with selected checkbox types in query params', async () => {
    const from = new Date(2026, 5, 24, 0, 1)
    const operationId = 'abcdef1234567890abcdef1234567890'
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
        operationId,
        stockMode: DailyDataSyncStockMode.DocumentsOnly,
        to,
        types,
      }),
    ).resolves.toEqual({
      Message: 'Синхронізацію запущено',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/data/sync/start/daily', {
      headers: {
        'X-GBA-Sync-Operation-Id': operationId,
      },
      method: 'POST',
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

  it('always sends all 12 document types for a Full session', async () => {
    const operationId = 'fedcba0987654321fedcba0987654321'
    const allTypes = Object.values(SyncProductConsignmentType).map(String)
    apiRequestMock.mockResolvedValueOnce({ PipelineRunId: operationId })

    await startSyncSession({
      forAmg: false,
      from: '2025-01-01',
      mode: DataSyncSessionMode.Full,
      operationId,
      to: '2026-07-27',
      types: [String(SyncProductConsignmentType.Sales)],
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/data/sync/start/session', {
      headers: {
        'X-GBA-Sync-Operation-Id': operationId,
      },
      method: 'POST',
      query: {
        forAmg: false,
        from: '2025-01-01',
        mode: DataSyncSessionMode.Full,
        to: '2026-07-27',
        types: allTypes,
      },
      errorMessages: {
        default: 'Не вдалося запустити сесію синхронізації',
        network: 'Сервер синхронізації недоступний',
      },
    })
  })

  it('sends the operator-selected repeated types for a Daily session', async () => {
    const operationId = '0123456789abcdef0123456789abcdef'
    const types = [
      String(SyncProductConsignmentType.Order),
      String(SyncProductConsignmentType.Sales),
      String(SyncProductConsignmentType.InternalMovementOfFunds),
    ]
    apiRequestMock.mockResolvedValueOnce({ PipelineRunId: operationId })

    await startSyncSession({
      forAmg: false,
      from: '2026-07-20',
      mode: DataSyncSessionMode.Daily,
      operationId,
      to: '2026-07-27',
      types,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/data/sync/start/session', {
      headers: {
        'X-GBA-Sync-Operation-Id': operationId,
      },
      method: 'POST',
      query: {
        forAmg: false,
        from: '2026-07-20',
        mode: DataSyncSessionMode.Daily,
        to: '2026-07-27',
        types,
      },
      errorMessages: {
        default: 'Не вдалося запустити сесію синхронізації',
        network: 'Сервер синхронізації недоступний',
      },
    })
  })

  it('creates a canonical non-empty operation id', () => {
    expect(createSyncOperationId()).toMatch(/^[0-9a-f]{32}$/)
    expect(createSyncOperationId()).not.toBe('00000000000000000000000000000000')
  })
})
