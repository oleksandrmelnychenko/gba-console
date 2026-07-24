import { describe, expect, it } from 'vitest'
import {
  cleanStartedBy,
  getSyncOperationLabel,
  getSyncScopeSummary,
  getSyncSessionStatusLabel,
  getSyncSessionTone,
  getVisibleSyncRun,
} from './syncSession'
import type { DataSyncPipelineRun, DataSyncStatus } from './types'

const finishedDailyRun: DataSyncPipelineRun = {
  AcceptedScope: {
    ForAmg: false,
    From: '2026-07-01T00:00:00',
    OperationType: 'Daily',
    StockMode: 'DocumentsOnly',
    SyncEntityTypes: [],
    To: '2026-07-23T23:59:59.9999999',
    Types: [0, 1, 2, 3, 6, 7, 8, 9, 10, 11],
  },
  CompletedAtUtc: '2026-07-24T13:58:58.9723421+00:00',
  FailedStep: null,
  PipelineRunId: 'bd7e0635ace445268e5d6a467b44b552',
  StartedAtUtc: '2026-07-24T13:58:48.6213591+00:00',
  StartedBy: '<Melnychenko Oleksandr>',
  Status: 'Finished',
  TerminalSequence: 206,
}

function createStatus(overrides: Partial<DataSyncStatus> = {}): DataSyncStatus {
  return {
    ActiveRun: null,
    InMemorySynchronizationInProgress: false,
    IsGlobalLockHeld: false,
    IsGlobalLockStatusAvailable: true,
    IsInProgress: false,
    LastTerminalRun: finishedDailyRun,
    ...overrides,
  }
}

describe('sync session presentation', () => {
  it('shows the active run instead of an older terminal run', () => {
    const activeRun: DataSyncPipelineRun = {
      ...finishedDailyRun,
      CompletedAtUtc: null,
      Status: 'Running',
      TerminalSequence: null,
    }
    const status = createStatus({
      ActiveRun: activeRun,
      IsGlobalLockHeld: true,
      IsInProgress: true,
    })

    expect(getVisibleSyncRun(status)).toBe(activeRun)
    expect(getSyncSessionTone(status)).toBe('running')
    expect(getSyncSessionStatusLabel('running')).toBe('Виконується')
  })

  it('does not present the previous terminal run as active while the global lock is held', () => {
    const status = createStatus({
      ActiveRun: null,
      IsGlobalLockHeld: true,
      IsInProgress: true,
    })

    expect(getVisibleSyncRun(status)).toBeNull()
    expect(getSyncSessionTone(status)).toBe('running')
  })

  it('summarizes daily scope without exposing operation ids', () => {
    expect(getSyncOperationLabel('Daily')).toBe('Щоденна синхронізація')
    expect(getSyncScopeSummary(finishedDailyRun.AcceptedScope)).toBe(
      '01.07.2026 – 23.07.2026 · 10 типів документів · без зміни залишків',
    )
    expect(cleanStartedBy(finishedDailyRun.StartedBy)).toBe('Melnychenko Oleksandr')
  })

  it('reports terminal success and failure from durable server state', () => {
    expect(getSyncSessionTone(createStatus())).toBe('success')
    expect(
      getSyncSessionTone(
        createStatus({
          LastTerminalRun: {
            ...finishedDailyRun,
            FailedStep: 'DailyDocuments',
            Status: 'Failed',
          },
        }),
      ),
    ).toBe('error')
  })

  it('summarizes full sync by the selected section count', () => {
    expect(
      getSyncScopeSummary({
        ForAmg: true,
        From: null,
        OperationType: 'DataSync',
        StockMode: null,
        SyncEntityTypes: [0, 1, 2, 3, 4],
        To: null,
        Types: [],
      }),
    ).toBe('5 розділів')
  })
})
