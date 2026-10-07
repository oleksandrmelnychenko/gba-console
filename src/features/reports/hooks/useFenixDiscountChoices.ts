import { useEffect, useRef } from 'react'
import { getFenixDiscountReadiness, readFenixDiscountChoices } from '../api/originalFenixDiscountAnalysisApi'
import { fenixDiscountDateError, fenixDiscountRequest } from '../data/originalFenixDiscountAnalysis'
import type { FenixDiscountChoices, FenixDiscountReadiness } from '../data/originalFenixDiscountAnalysisChoices'
import { useReportRunState } from './useReportRunState'
export function useFenixDiscountChoices(through: string, permitted: boolean, callerKey: string | null) {
  const key = JSON.stringify([through, permitted, callerKey]), run = useReportRunState<{ names: FenixDiscountChoices; readiness: FenixDiscountReadiness }>(key)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [key])
  async function load() {
    if (!permitted || !callerKey || fenixDiscountDateError(through) || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; const update = run.begin()
    try {
      const [names, readiness] = await Promise.all([readFenixDiscountChoices(fenixDiscountRequest(through), controller.signal), getFenixDiscountReadiness(controller.signal)])
      if (!controller.signal.aborted) update({ lastRun: { names, readiness } })
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }
  return { key, run, load }
}
