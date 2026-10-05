import { useEffect, useRef } from 'react'
import { deleteAmgDiscountVariant, listAmgDiscountVariants, loadAmgDiscountVariant, saveAmgDiscountVariant } from '../api/originalAmgDiscountAnalysisVariantsApi'
import type { AmgDiscountVariant, AmgDiscountVariantList, AmgDiscountVariantSave } from '../data/originalAmgDiscountAnalysisVariants'
import { useReportRunState } from './useReportRunState'
export function useAmgDiscountVariants(callerKey: string | null, permitted: boolean, contextKey: string) {
  const run = useReportRunState<{ list: AmgDiscountVariantList; active: AmgDiscountVariant | null }>(JSON.stringify([callerKey, permitted])), active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [callerKey, permitted])
  useEffect(() => { if (active.current) { active.current.abort(); active.current = null; run.clear() } }, [contextKey, run.clear])
  async function perform(action: (signal: AbortSignal) => Promise<AmgDiscountVariant | null>, onLoad?: (variant: AmgDiscountVariant) => void) {
    if (!permitted || !callerKey || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; const update = run.begin()
    try {
      const selected = await action(controller.signal)
      if (controller.signal.aborted) return
      const list = await listAmgDiscountVariants(controller.signal)
      if (!controller.signal.aborted) { update({ lastRun: { list, active: selected } }); if (selected) onLoad?.(selected) }
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося відкрити варіанти AMG.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }); if (active.current === controller) active.current = null }
  }
  return { run,
    refresh: () => perform(async () => null),
    load: (variant: AmgDiscountVariant, onLoad: (v: AmgDiscountVariant) => void) => perform(signal => loadAmgDiscountVariant(variant, signal), onLoad),
    save: (request: AmgDiscountVariantSave, onSaved: (v: AmgDiscountVariant) => void) => perform(signal => saveAmgDiscountVariant(request, signal), onSaved),
    remove: (variant: AmgDiscountVariant) => perform(async signal => { await deleteAmgDiscountVariant(variant, signal); return null }),
  }
}
