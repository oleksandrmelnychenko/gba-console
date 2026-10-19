import type { DataSyncNotification } from './events'
import { classifyDataSyncNotification, normalizeDataSyncRunId } from './dataSyncProgressStore'

export const DATA_SYNC_ERROR_NOTIFICATION_ID = 'data-sync-error'

export type DataSyncToastAction =
  | { type: 'none' }
  | { type: 'hide-error' }
  | { type: 'show-error'; runId?: string }

export function getDataSyncToastAction(
  notification: DataSyncNotification,
  shownErrorRunId: string | null | undefined,
): DataSyncToastAction {
  const kind = classifyDataSyncNotification(notification)
  const runId = normalizeDataSyncRunId(notification.PipelineRunId)

  if (kind === 'terminal-error') {
    return { type: 'show-error', runId }
  }

  if (kind === 'terminal-success') {
    return { type: 'hide-error' }
  }

  if (kind === 'progress' && runId && runId !== normalizeDataSyncRunId(shownErrorRunId)) {
    return { type: 'hide-error' }
  }

  return { type: 'none' }
}
