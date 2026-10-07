import { useEffect, useState } from 'react'
import { emptyAmgDiscountAnalysisSelection, type AmgDiscountAnalysisField, type AmgDiscountAnalysisSelection } from '../data/originalAmgDiscountAnalysisChoices'
import { restoreAmgDiscountVariantSelection, type AmgDiscountVariant, type AmgDiscountVariantScope } from '../data/originalAmgDiscountAnalysisVariants'
import type { useAmgDiscountAnalysisChoices } from './useAmgDiscountAnalysisChoices'
import { useReportRunState } from './useReportRunState'
export function useAmgDiscountAnalysisSelection(names: ReturnType<typeof useAmgDiscountAnalysisChoices>, callerKey: string | null, canGenerate: boolean, permitted: boolean) {
  const named = names.run.lastRun?.names ?? null
  const [selection, setSelection] = useState<{ key: string; witness: string | null; values: AmgDiscountAnalysisSelection }>({ key: '', witness: null, values: emptyAmgDiscountAnalysisSelection() })
  const variant = useReportRunState<AmgDiscountVariantScope>(JSON.stringify([callerKey, canGenerate, permitted])), pending = variant.lastRun
  useEffect(() => { if (pending) void names.load(pending.Request) }, [pending, names.load])
  const restored = pending ? restoreAmgDiscountVariantSelection(pending, named) : null
  const blockedVariant = !!pending && !restored
  const selected = named && selection.key === names.key && selection.witness === named.ResultSha256 ? selection.values : restored ?? emptyAmgDiscountAnalysisSelection()
  function clearSelection() { setSelection({ key: '', witness: null, values: emptyAmgDiscountAnalysisSelection() }) }
  function clear() { variant.clear(); clearSelection() }
  function select(field: AmgDiscountAnalysisField, values: string[]) { variant.clear(); setSelection({ key: names.key, witness: named?.ResultSha256 ?? null, values: { ...selected, [field]: [...values] } }) }
  function load(saved: AmgDiscountVariant) { clearSelection(); variant.update({ lastRun: saved.Scope }) }
  return { selected, pending, blockedVariant, clearSelection, clear, select, load }
}
