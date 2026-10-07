import { useEffect, useRef } from 'react'
import { readAmgDiscountChoices } from '../api/originalAmgClientDiscountsApi'
import { amgDateError, amgDiscountRequest, type AmgDiscountChoices } from '../data/originalAmgClientDiscounts'
import { useReportRunState } from './useReportRunState'
export function useAmgDiscountChoices(through: string, permitted: boolean, callerKey: string | null) {
  const key = JSON.stringify([through, permitted, callerKey]), run = useReportRunState<AmgDiscountChoices>(key), active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [key])
  async function load() {
    if (!permitted || !callerKey || amgDateError(through) || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; const update = run.begin()
    try { const result = await readAmgDiscountChoices(amgDiscountRequest(through), controller.signal); if (!controller.signal.aborted) update({ lastRun: result }) }
    catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }
  return { key, run, load }
}
