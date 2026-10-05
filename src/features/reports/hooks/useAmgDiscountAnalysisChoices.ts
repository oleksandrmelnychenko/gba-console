import { useEffect, useRef } from 'react'
import { getAmgDiscountAnalysisReadiness, readAmgDiscountAnalysisChoices } from '../api/originalAmgDiscountAnalysisApi'
import { amgDiscountAnalysisDateError, amgDiscountAnalysisRequest } from '../data/originalAmgDiscountAnalysis'
import type { AmgDiscountAnalysisChoices, AmgDiscountAnalysisReadiness } from '../data/originalAmgDiscountAnalysisChoices'
import { useReportRunState } from './useReportRunState'
export function useAmgDiscountAnalysisChoices(through: string, permitted: boolean, callerKey: string | null) {
  const key = JSON.stringify([through, permitted, callerKey]), run = useReportRunState<{ names: AmgDiscountAnalysisChoices; readiness: AmgDiscountAnalysisReadiness }>(key)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [key])
  async function load() {
    if (!permitted || !callerKey || amgDiscountAnalysisDateError(through) || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; const update = run.begin()
    try {
      const [names, readiness] = await Promise.all([readAmgDiscountAnalysisChoices(amgDiscountAnalysisRequest(through), controller.signal), getAmgDiscountAnalysisReadiness(controller.signal)])
      if (!controller.signal.aborted) update({ lastRun: { names, readiness } })
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }
  return { key, run, load }
}
