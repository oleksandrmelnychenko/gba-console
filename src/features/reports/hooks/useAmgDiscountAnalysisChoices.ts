import { useCallback, useEffect, useRef } from 'react'
import { getAmgDiscountAnalysisReadiness, readAmgDiscountAnalysisChoices } from '../api/originalAmgDiscountAnalysisApi'
import { amgDiscountAnalysisDateError, amgDiscountAnalysisRequest, validateAmgDiscountAnalysisRequest, type AmgDiscountAnalysisRequest } from '../data/originalAmgDiscountAnalysis'
import type { AmgDiscountAnalysisChoices, AmgDiscountAnalysisReadiness } from '../data/originalAmgDiscountAnalysisChoices'
import { useReportRunState } from './useReportRunState'
export function useAmgDiscountAnalysisChoices(through: string, permitted: boolean, callerKey: string | null) {
  const key = JSON.stringify([through, permitted, callerKey]), run = useReportRunState<{ names: AmgDiscountAnalysisChoices; readiness: AmgDiscountAnalysisReadiness }>(key)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [key])
  const load = useCallback(async (request?: AmgDiscountAnalysisRequest) => {
    if (!permitted || !callerKey || amgDiscountAnalysisDateError(through) || active.current && !active.current.signal.aborted) return
    const scope = validateAmgDiscountAnalysisRequest(request ?? amgDiscountAnalysisRequest(through))
    if (scope.Through !== through) return
    delete scope.ChoicesWitnessSha256
    const controller = new AbortController(); active.current?.abort(); active.current = controller; const update = run.begin()
    try {
      const [names, readiness] = await Promise.all([readAmgDiscountAnalysisChoices(scope, controller.signal), getAmgDiscountAnalysisReadiness(controller.signal)])
      if (!controller.signal.aborted) update({ lastRun: { names, readiness } })
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }); if (active.current === controller) active.current = null }
  }, [through, permitted, callerKey, run.begin])
  const clear = useCallback(() => { active.current?.abort(); active.current = null; run.clear() }, [run.clear])
  return { key, run, load, clear }
}
