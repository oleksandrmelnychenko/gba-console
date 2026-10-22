import { describe, expect, it } from 'vitest'
import { describeSyncSource } from './syncSourceEvidence'
import type { DataSyncStatus } from '../../header-actions/types'
describe('durable sync evidence', () => {
  it('never labels a failed terminal run as a success or a source watermark', () => {
    const evidence = describeSyncSource({ LastTerminalRun: { Status: 'Failed', CompletedAtUtc: '2026-10-22T10:00:00Z', FailedStep: 'receipts' } } as DataSyncStatus)
    expect(evidence.lastSuccess).toBeNull()
    expect(evidence.failedStep).toBe('receipts')
    expect(evidence.total).toBeNull()
  })
  it('preserves the previous successful completion when the latest run failed', () => {
    const evidence = describeSyncSource({ LastSuccessfulRun: { Status: 'Finished', CompletedAtUtc: '2026-10-20T10:00:00Z' }, LastTerminalRun: { Status: 'Failed', CompletedAtUtc: '2026-10-22T10:00:00Z', FailedStep: 'receipts' } } as DataSyncStatus)
    expect(evidence.lastSuccess).toBe('2026-10-20T10:00:00Z')
    expect(evidence.failedStep).toBe('receipts')
  })
  it('counts only completed/failed stages within the published session', () => {
    const evidence = describeSyncSource({ LastTerminalRun: { Status: 'Finished', CompletedAtUtc: '2026-10-22T10:00:00Z' }, Session: { TotalStages: 3, Stages: [{ Status: 'Finished' }, { Status: 'Failed' }, { Status: 'Running' }] } } as DataSyncStatus)
    expect(evidence).toMatchObject({ lastSuccess: '2026-10-22T10:00:00Z', completed: 1, failed: 1, total: 3 })
  })
})
