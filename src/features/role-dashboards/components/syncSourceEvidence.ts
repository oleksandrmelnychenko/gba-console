import type { DataSyncStatus } from '../../header-actions/types'

export function describeSyncSource(status: DataSyncStatus) {
  const terminal = status.LastTerminalRun
  const stages = status.Session?.Stages ?? []
  const lastSuccess = terminal?.Status === 'Finished' ? terminal.CompletedAtUtc : null
  const completed = stages.filter((stage) => stage.Status === 'Finished' || stage.Status === 'Completed').length
  const failed = stages.filter((stage) => stage.Status === 'Failed').length
  return { lastSuccess, completed, failed,
    failedStep: status.ActiveRun?.FailedStep ?? terminal?.FailedStep ?? stages.find((stage) => stage.FailedStep)?.FailedStep,
    total: status.Session?.TotalStages ?? null,
  }
}
