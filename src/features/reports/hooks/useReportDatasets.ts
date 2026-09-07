import { useEffect, useState } from 'react'
import { getReportDatasets } from '../api/reportWorkspaceApi'
import type { ReportDataset } from '../types'

export function useReportDatasets(enabled: boolean) {
  const [state, setState] = useState<{ datasets: ReportDataset[]; error: string | null; loaded: boolean }>({ datasets: [], error: null, loaded: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void getReportDatasets(controller.signal).then(datasets => {
      if (!controller.signal.aborted) setState({ datasets, error: null, loaded: true })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ datasets: [], error: error instanceof Error ? error.message : 'Не вдалося завантажити набори даних звітів.', loaded: true })
    })
    return () => controller.abort()
  }, [enabled, attempt])
  return { ...state, retry: () => {
    setState({ datasets: [], error: null, loaded: false })
    setAttempt(current => current + 1)
  } }
}
