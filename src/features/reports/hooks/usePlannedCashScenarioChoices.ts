import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPlannedCashScenarioChoices } from '../api/plannedCashApi'
import { isPlannedCashCapabilities, plannedCashPeriodFilterError, type PlannedCashCapabilities, type PlannedCashFilters } from '../data/plannedCash'
import { createPlannedCashScenarioChoicesRequest, normalizePlannedCashScenarioChoices, type PlannedCashScenarioChoice } from '../data/plannedCashScenarioChoices'

type ChoiceState = { scope: string; choices: PlannedCashScenarioChoice[]; continuation: string | null; seen: string[]
  available: boolean | null; loading: boolean; error: string | null; selected: string | null }
const empty = (scope: string): ChoiceState => ({ scope, choices: [], continuation: null, seen: [], available: null, loading: false, error: null, selected: null })

/** A genuine server list is scoped to the owner, form and both periods; no first entry is selected implicitly. */
export function usePlannedCashScenarioChoices({ capability, filters, canGenerate, callerKey }: {
  capability: PlannedCashCapabilities; filters: PlannedCashFilters; canGenerate: boolean; callerKey: string | null
}) {
  const [revision, setRevision] = useState(0)
  const binding = JSON.stringify({ capability, filters, canGenerate, callerKey })
  const bound = useMemo(() => JSON.parse(binding) as { capability: PlannedCashCapabilities; filters: PlannedCashFilters; canGenerate: boolean; callerKey: string | null }, [binding])
  const scope = JSON.stringify([binding, revision])
  const eligible = bound.canGenerate && Boolean(bound.callerKey) && isPlannedCashCapabilities(bound.capability) && bound.capability.RuntimeImplemented
    && bound.capability.ScenarioChoiceApiImplemented && !plannedCashPeriodFilterError(bound.capability, bound.filters)
  const [stored, setStored] = useState(() => empty(scope))
  const current = stored.scope === scope ? stored : empty(scope)
  const active = useRef<{ scope: string; controller: AbortController } | null>(null)
  const load = useCallback(async (continuation: string | null) => {
    if (!eligible || !bound.callerKey || active.current) return
    const attempt = { scope, controller: new AbortController() }; active.current = attempt
    setStored(previous => ({ ...(continuation === null || previous.scope !== scope ? empty(scope) : previous), loading: true, error: null }))
    try {
      const command = createPlannedCashScenarioChoicesRequest(bound.capability, bound.filters, continuation)
      const response = await getPlannedCashScenarioChoices(bound.capability, bound.filters, bound.callerKey, attempt.controller.signal, continuation)
      const page = normalizePlannedCashScenarioChoices(response, command)
      if (attempt.controller.signal.aborted || active.current !== attempt) return
      setStored(previous => {
        if (previous.scope !== scope) return previous
        if (!page.Available) return { ...empty(scope), available: false }
        const first = continuation === null, prior = first ? empty(scope) : previous
        const keys = new Set(prior.choices.map(choice => choice.Key))
        if (page.Choices.some(choice => keys.has(choice.Key)) || page.ContinuationKey !== null
          && (page.ContinuationKey === continuation || prior.seen.includes(page.ContinuationKey))) {
          return { ...empty(scope), error: 'Список сценаріїв змінився. Оновіть його та оберіть сценарій знову.' }
        }
        return { ...prior, choices: [...prior.choices, ...page.Choices], continuation: page.ContinuationKey,
          seen: continuation === null ? [] : [...prior.seen, continuation], available: page.Available, loading: false }
      })
    } catch (error) {
      if (!attempt.controller.signal.aborted && active.current === attempt) setStored(previous => ({ ...empty(scope),
        error: error instanceof Error ? error.message : 'Не вдалося завантажити сценарії.', seen: previous.scope === scope ? previous.seen : [] }))
    } finally { if (active.current === attempt) active.current = null }
  }, [bound, eligible, scope])
  useEffect(() => {
    void load(null)
    return () => { const attempt = active.current; if (attempt?.scope === scope) { attempt.controller.abort(); active.current = null } }
  }, [load, scope])
  const refresh = () => { active.current?.controller.abort(); active.current = null; setRevision(previous => previous + 1) }
  const select = (key: string) => setStored(previous => previous.scope === scope && previous.available === true && previous.choices.some(choice => choice.Key === key)
    ? { ...previous, selected: key } : previous)
  const selectedKey = current.available === true && current.choices.some(choice => choice.Key === current.selected) ? current.selected : null
  return { ...current, scope, eligible, selectedKey, select, refresh, loadMore: () => { if (current.continuation && !current.loading) void load(current.continuation) } }
}
