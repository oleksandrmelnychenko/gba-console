import { useEffect, useReducer, useState } from 'react'
import { getDashboardWorkspaceSummary } from '../api/dashboardWorkspacesApi'
import type { DashboardWorkspaceKey, DashboardWorkspacePeriod, DashboardWorkspaceSummary } from '../types'
import { useI18n } from '../../../shared/i18n/useI18n'

export type WorkspaceSummaryState = {
  error: string | null
  isRefreshing: boolean
  reload: () => void
  summary: DashboardWorkspaceSummary | null
}

export function useWorkspaceSummary(
  workspaceKey: DashboardWorkspaceKey,
  period: DashboardWorkspacePeriod,
): WorkspaceSummaryState {
  const { t } = useI18n()
  const [summary, setSummary] = useState<DashboardWorkspaceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setRefreshing] = useState(false)
  const [reloadKey, reload] = useReducer((value: number) => value + 1, 0)

  useEffect(() => {
    const controller = new AbortController()
    let requestInFlight = false

    async function load(reset: boolean) {
      if (requestInFlight) {
        return
      }

      requestInFlight = true
      setRefreshing(true)
      setError(null)

      if (reset) {
        setSummary(null)
      }

      try {
        const loaded = await getDashboardWorkspaceSummary(workspaceKey, period, controller.signal)

        if (!controller.signal.aborted) {
          setSummary(loaded)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити показники'))
        }
      } finally {
        requestInFlight = false

        if (!controller.signal.aborted) {
          setRefreshing(false)
        }
      }
    }

    void load(true)

    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(false)
      }
    }, getRefreshInterval(workspaceKey))

    return () => {
      window.clearInterval(refreshTimer)
      controller.abort()
    }
  }, [period, reloadKey, t, workspaceKey])

  return { error, isRefreshing, reload, summary }
}

function getRefreshInterval(workspaceKey: DashboardWorkspaceKey): number {
  return workspaceKey === 'accounting' || workspaceKey === 'finance' || workspaceKey === 'executive'
    ? 300_000
    : 60_000
}
