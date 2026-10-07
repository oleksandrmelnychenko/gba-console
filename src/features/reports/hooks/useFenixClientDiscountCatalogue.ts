import { useEffect, useMemo, useRef } from 'react'
import { readFenixDiscountChoiceCatalogue } from '../api/originalFenixClientDiscountPagesApi'
import { fenixDateError, fenixDiscountRequest } from '../data/originalFenixClientDiscounts'
import type { FenixDiscountCatalogue } from '../data/originalFenixClientDiscountPages'
import { useReportRunState } from './useReportRunState'
export function useFenixClientDiscountCatalogue(through: string, permitted: boolean, callerKey: string | null) {
  const scope = useMemo(() => ({ through, permitted, callerKey }), [through, permitted, callerKey])
  const key = JSON.stringify(scope), run = useReportRunState<FenixDiscountCatalogue>(key), active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [scope])
  async function load() {
    if (!permitted || !callerKey || fenixDateError(through) || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; const update = run.begin()
    try { const result = await readFenixDiscountChoiceCatalogue(fenixDiscountRequest(through), controller.signal); if (!controller.signal.aborted) update({ lastRun: result }) }
    catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }
  return { key, scope, run, load }
}
