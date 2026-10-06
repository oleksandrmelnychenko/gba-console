import { useLayoutEffect, useRef, useState } from 'react'
import { readOriginalStockAvailability } from '../api/originalStockAvailabilityApi'
import { stockAxes, type StockAxis, type StockFilter, type StockRequest } from '../data/originalStockAvailability'
import type { StockChoices, StockResult } from '../data/originalStockAvailabilityResponse'
import { useReportRunState } from './useReportRunState'
const emptyChoices = (): StockChoices => Object.fromEntries(stockAxes.map(a => [a, []])) as StockChoices
export function useStockAvailabilitySelection(scope: string) {
  const [stored, setStored] = useState(() => ({ scope, choices: emptyChoices(), filters: [] as StockFilter[] }))
  let current = stored
  if (stored.scope !== scope) { current = { scope, choices: emptyChoices(), filters: [] }; setStored(current) }
  function select(field: StockAxis, key: string | null) {
    if (key !== null && !current.choices[field].some(v => v.Key === key)) return
    setStored(previous => previous.scope === scope ? { ...previous, filters: [...previous.filters.filter(v => v.Field !== field), ...(key === null ? [] : [{ Field: field, Key: key }])] } : previous)
  }
  function receive(result: StockResult) {
    if (!result.OurSnapshotVerified || !result.NormalInputsComplete) return
    setStored(previous => {
      if (previous.scope !== scope) return previous
      const selectedFields = new Map(previous.filters.map(f => [f.Field, f]))
      const choices = Object.fromEntries(stockAxes.map(a => {
        const selected = selectedFields.get(a), fresh = result.Choices[a]
        const retained = selected && !fresh.some(v => v.Key === selected.Key) ? previous.choices[a].filter(v => v.Key === selected.Key) : []
        return [a, [...fresh, ...retained]]
      })) as StockChoices
      return { ...previous, choices }
    })
  }
  return { choices: current.choices, filters: current.filters, select, receive }
}
export function useOriginalStockAvailability(request: StockRequest | null, callerKey: string | null, canGenerate: boolean, receive: (value: StockResult) => void) {
  const key = JSON.stringify([request, callerKey, canGenerate]), run = useReportRunState<StockResult>(key), active = useRef<AbortController | null>(null)
  useLayoutEffect(() => () => { active.current?.abort(); active.current = null }, [key])
  function invalidate() { active.current?.abort(); active.current = null; run.clear() }
  async function generate() {
    if (!request || !callerKey || !canGenerate || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    const update = run.begin()
    try {
      const result = await readOriginalStockAvailability(request, controller.signal)
      if (!controller.signal.aborted && active.current === controller) { receive(result); update({ lastRun: result }) }
    } catch (failure) {
      if (!controller.signal.aborted && active.current === controller) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати доступність товарів.' })
    } finally { update({ isLoading: false }) }
  }
  return { ...run, allowed: !!request && !!callerKey && canGenerate, generate, invalidate }
}
