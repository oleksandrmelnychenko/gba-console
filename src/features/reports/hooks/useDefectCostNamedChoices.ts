import { useEffect, useRef } from 'react'
import { readDefectCostChoices } from '../api/originalDefectCostApi'
import { defectCostPeriodError, defectCostRequest, type DefectCostCapability, type DefectCostChoicesResult } from '../data/originalDefectCost'
import { useReportRunState } from './useReportRunState'

/** Names cover the full normal scope. Report selectors and optional money columns do not change this request. */
export function useDefectCostNamedChoices(capability: DefectCostCapability, callerKey: string | null, canGenerate: boolean, from: string, through: string) {
  const key = JSON.stringify([callerKey, canGenerate, capability, from, through]), run = useReportRunState<DefectCostChoicesResult>(key)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => { active.current?.abort() }, [key])
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.ScopedNamedChoicesSupported
  async function load() {
    if (!permitted || defectCostPeriodError(from, through) || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; const update = run.begin()
    try {
      const result = await readDefectCostChoices(defectCostRequest(capability, from, through), controller.signal)
      if (!controller.signal.aborted) update({ lastRun: result })
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви.' }) }
    finally { update({ isLoading: false }) }
  }
  return { key, run, permitted, load }
}
