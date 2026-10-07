import { useEffect, useRef } from 'react'
import { readPurchasesChoices } from '../api/originalPurchasesApi'
import { purchasesPeriodError, purchasesRequest, type PurchasesCapability } from '../data/originalPurchases'
import type { PurchasesChoices } from '../data/originalPurchasesChoices'
import { useReportRunState } from './useReportRunState'

/** A canonical unfiltered request covers the entire period, independently of selected filters and quantity columns. */
export function usePurchasesNamedChoices(capability: PurchasesCapability, callerKey: string | null, canGenerate: boolean, from: string, through: string) {
  const key = JSON.stringify([callerKey, canGenerate, capability, from, through]), run = useReportRunState<PurchasesChoices>(key)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => { active.current?.abort() }, [key])
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  async function load() {
    if (!permitted || purchasesPeriodError(from, through) || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; const update = run.begin()
    try {
      const result = await readPurchasesChoices(purchasesRequest(capability, from, through), controller.signal)
      if (!controller.signal.aborted) update({ lastRun: result })
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви.' }) }
    finally { update({ isLoading: false }) }
  }
  return { key, run, permitted, load }
}
