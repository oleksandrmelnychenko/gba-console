import { useEffect, useMemo, useRef } from 'react'
import { readFenixDiscountChoices } from '../api/originalFenixClientDiscountsApi'
import { fenixDateError, fenixDiscountRequest, type FenixDiscountChoices } from '../data/originalFenixClientDiscounts'
import { useReportRunState } from './useReportRunState'
export function useFenixClientDiscountChoices(through: string, permitted: boolean, callerKey: string | null) {
  const scope = useMemo(() => ({ through, permitted, callerKey }), [through, permitted, callerKey])
  const key = JSON.stringify(scope), run = useReportRunState<FenixDiscountChoices>(key), active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [key])
  async function load() {
    if (!permitted || !callerKey || fenixDateError(through) || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; const update = run.begin()
    try { const result = await readFenixDiscountChoices(fenixDiscountRequest(through), controller.signal); if (!controller.signal.aborted) update({ lastRun: result }) }
    catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }
  return { key, scope, run, load }
}
