import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { readOriginalOrderAnalyses, readOriginalOrderAnalysisChoices } from '../api/originalOrderAnalysesApi'
import { orderAnalysisFilterKey, orderAnalysisPeriodError, orderAnalysisRequest, type OrderAnalysisCapability, type OrderAnalysisField, type OrderAnalysisFilter, type OrderAnalysisRequest } from '../data/originalOrderAnalyses'
import type { OrderAnalysisChoices, OrderAnalysisResult } from '../data/originalOrderAnalysisResponse'
import { useReportRunState } from './useReportRunState'
export function useOrderAnalysisChoices(capability: OrderAnalysisCapability, from: string, through: string, callerKey: string | null, canGenerate: boolean) {
  const scope = JSON.stringify([capability, from, through, callerKey, canGenerate]), active = useRef<AbortController | null>(null)
  const [stored, setStored] = useState<{ scope: string; data: OrderAnalysisChoices | null; error: string | null; busy: boolean } | null>(null)
  const [selected, setSelected] = useState<{ scope: string; filters: OrderAnalysisFilter[] }>({ scope, filters: [] })
  const current = stored?.scope === scope ? stored : null, filters = selected.scope === scope ? selected.filters : []
  useLayoutEffect(() => {
    setStored(null); setSelected({ scope, filters: [] })
    return () => { active.current?.abort(); active.current = null }
  }, [scope])
  useEffect(() => {
    if (!canGenerate || !callerKey || orderAnalysisPeriodError(from, through)) return
    const controller = new AbortController(); active.current = controller
    setStored({ scope, data: null, error: null, busy: true })
    const request = orderAnalysisRequest(capability, from, through, capability.DefaultRows, capability.DefaultMeasures, [], null, null)
    readOriginalOrderAnalysisChoices(request, controller.signal).then(data => {
      if (!controller.signal.aborted && active.current === controller) setStored({ scope, data, error: null, busy: false })
    }).catch(failure => {
      if (!controller.signal.aborted && active.current === controller) setStored({ scope, data: null, error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви для відбору.', busy: false })
    })
    return () => controller.abort()
  }, [scope, capability, from, through, callerKey, canGenerate])
  function select(field: OrderAnalysisField, key: string | null) {
    const value = key === null ? null : current?.data?.Choices.find(v => v.Field === field && orderAnalysisFilterKey(v) === key)
    if (key !== null && !value) return
    const next = filters.filter(v => v.Field !== field)
    if (value) next.push({ Field: value.Field, Value: { ...value.Value } })
    setSelected({ scope, filters: next })
  }
  return { choices: current?.data?.Choices ?? [], unresolved: current?.data?.UnresolvedChoices ?? [], filters, select, choicesBusy: current?.busy ?? false, choicesError: current?.error ?? null }
}
export function useOriginalOrderAnalyses(request: OrderAnalysisRequest | null, callerKey: string | null, canGenerate: boolean) {
  const key = JSON.stringify([request, callerKey, canGenerate]), run = useReportRunState<OrderAnalysisResult>(key), active = useRef<AbortController | null>(null)
  useLayoutEffect(() => () => { active.current?.abort(); active.current = null }, [key])
  function invalidate() { active.current?.abort(); active.current = null; run.clear() }
  async function generate() {
    if (!request || !callerKey || !canGenerate || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    const update = run.begin()
    try {
      const result = await readOriginalOrderAnalyses(request, controller.signal)
      if (!controller.signal.aborted && active.current === controller) update({ lastRun: result })
    } catch (failure) {
      if (!controller.signal.aborted && active.current === controller) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати аналіз замовлень.' })
    } finally { update({ isLoading: false }) }
  }
  return { ...run, allowed: !!request && !!callerKey && canGenerate, generate, invalidate }
}
