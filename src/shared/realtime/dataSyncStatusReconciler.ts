import { useEffect } from 'react'
import { apiRequest } from '../api/apiClient'
import {
  getDataSyncProgressRevision,
  reconcileDataSyncProgress,
  useIsDataSyncActive,
} from './dataSyncProgressStore'

type DataSyncStatus = {
  IsInProgress?: boolean
  isInProgress?: boolean
  PipelineRunId?: string | null
  RunId?: string | null
}

export const DATA_SYNC_WATCHDOG_INTERVAL_MS = 60_000

export async function reconcileDataSyncProgressWithServer(): Promise<void> {
  const revision = getDataSyncProgressRevision()

  try {
    const status = await apiRequest<DataSyncStatus>('/data/sync/status', {
      dedupe: false,
      errorMessages: {
        default: 'Не вдалося перевірити статус синхронізації',
        network: 'Сервер синхронізації недоступний',
      },
    })

    reconcileDataSyncProgress(Boolean(status?.IsInProgress ?? status?.isInProgress), {
      revision,
      runId: status?.PipelineRunId ?? status?.RunId,
    })
  } catch {
    return
  }
}

export function useDataSyncProgressWatchdog(enabled: boolean): void {
  const isActive = useIsDataSyncActive()

  useEffect(() => {
    if (!enabled || !isActive) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      void reconcileDataSyncProgressWithServer()
    }, DATA_SYNC_WATCHDOG_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [enabled, isActive])
}
