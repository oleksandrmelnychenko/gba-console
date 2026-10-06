import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { readOriginalOrderAnalyses, readOriginalOrderAnalysisChoices } from '../api/originalOrderAnalysesApi'
import { orderAnalysisFilterKey, orderAnalysisPeriodError, orderAnalysisRequest, type OrderAnalysisCapability, type OrderAnalysisField, type OrderAnalysisFilter, type OrderAnalysisRequest } from '../data/originalOrderAnalyses'
import type { OrderAnalysisChoices, OrderAnalysisResult } from '../data/originalOrderAnalysisResponse'
import { useReportRunState } from './useReportRunState'
type ChoiceScope = { key: string; capability: OrderAnalysisCapability; from: string; through: string; callerKey: string | null; canGenerate: boolean }
type ChoiceState = { scope: ChoiceScope; data: OrderAnalysisChoices | null; error: string | null; filters: OrderAnalysisFilter[] }
const emptyChoiceState = (scope: ChoiceScope): ChoiceState => ({ scope, data: null, error: null, filters: [] })
export function useOrderAnalysisChoices(capability: OrderAnalysisCapability, from: string, through: string, callerKey: string | null, canGenerate: boolean) {
  const key = JSON.stringify([capability, from, through, callerKey, canGenerate]), active = useRef<AbortController | null>(null)
  const [stored, setStored] = useState(() => emptyChoiceState({ key, capability, from, through, callerKey, canGenerate }))
  let current = stored
  // Each observed scope change creates a distinct owner; A→B→A cannot recover A's state or callbacks.
  if (stored.scope.key !== key) {
    current = emptyChoiceState({ key, capability, from, through, callerKey, canGenerate }); setStored(current)
  }
  const scope = current.scope, filters = current.filters
  useLayoutEffect(() => () => { active.current?.abort(); active.current = null }, [scope])
  useEffect(() => {
    if (!scope.canGenerate || !scope.callerKey || orderAnalysisPeriodError(scope.from, scope.through)) return
    const controller = new AbortController(); active.current = controller
    const request = orderAnalysisRequest(scope.capability, scope.from, scope.through, scope.capability.DefaultRows, scope.capability.DefaultMeasures, [], null, null)
    readOriginalOrderAnalysisChoices(request, controller.signal).then(data => {
      if (!controller.signal.aborted && active.current === controller) setStored(previous => previous.scope === scope ? { ...previous, data, error: null } : previous)
    }).catch(failure => {
      if (!controller.signal.aborted && active.current === controller) setStored(previous => previous.scope === scope
        ? { ...previous, data: null, error: failure instanceof Error ? failure.message : 'Не вдалося завантажити назви для відбору.' } : previous)
    })
    return () => controller.abort()
  }, [scope])
  function select(field: OrderAnalysisField, key: string | null) {
    const value = key === null ? null : current.data?.Choices.find(v => v.Field === field && orderAnalysisFilterKey(v) === key)
    if (key !== null && !value) return
    setStored(previous => {
      if (previous.scope !== scope) return previous
      const next = previous.filters.filter(v => v.Field !== field)
      if (value) next.push({ Field: value.Field, Value: { ...value.Value } })
      return { ...previous, filters: next }
    })
  }
  const eligible = canGenerate && !!callerKey && !orderAnalysisPeriodError(from, through)
  return { choices: current.data?.Choices ?? [], unresolved: current.data?.UnresolvedChoices ?? [], filters, select,
    choicesBusy: eligible && current.data === null && current.error === null, choicesError: current.error }
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
