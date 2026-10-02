import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { getCashMovementArticleChoices } from '../api/cashMovementApi'
import { isCashMovementCapabilities, cashMovementKind, cashMovementPeriodError, type CashMovementCapabilities } from '../data/cashMovement'
import { createCashMovementArticleChoicesRequest, normalizeCashMovementArticleChoices, type CashMovementArticleChoice } from '../data/cashMovementArticleChoices'

type ChoiceState = { scope: string; choices: CashMovementArticleChoice[]; continuation: string | null; seen: string[]
  available: boolean | null; loading: boolean; error: string | null; selected: string | null }
const empty = (scope: string): ChoiceState => ({ scope, choices: [], continuation: null, seen: [], available: null, loading: false, error: null, selected: null })

/** A genuine server list is scoped to the owner, form and its period; no first entry is selected implicitly. */
export function useCashMovementArticleChoices({ capability, period, canGenerate, callerKey }: {
  capability: CashMovementCapabilities; period: string; canGenerate: boolean; callerKey: string | null
}) {
  const [revision, setRevision] = useState(0)
  const binding = JSON.stringify({ capability, period, canGenerate, callerKey })
  const bound = useMemo(() => JSON.parse(binding) as { capability: CashMovementCapabilities; period: string; canGenerate: boolean; callerKey: string | null }, [binding])
  const scope = JSON.stringify([binding, revision])
  const eligible = bound.canGenerate && Boolean(bound.callerKey) && isCashMovementCapabilities(bound.capability) && bound.capability.Executable
    && bound.capability.ArticleChoiceApiImplemented && cashMovementKind(bound.capability) !== null && !cashMovementPeriodError(cashMovementKind(bound.capability)!, bound.period)
  const [stored, setStored] = useState(() => empty(scope))
  const current = stored.scope === scope ? stored : empty(scope)
  const active = useRef<{ scope: string; controller: AbortController } | null>(null)
  const load = useCallback(async (continuation: string | null) => {
    if (!eligible || !bound.callerKey || active.current) return
    const attempt = { scope, controller: new AbortController() }; active.current = attempt
    setStored(previous => ({ ...(continuation === null || previous.scope !== scope ? empty(scope) : previous), loading: true, error: null }))
    try {
      const command = createCashMovementArticleChoicesRequest(bound.capability, bound.period, continuation)
      const response = await getCashMovementArticleChoices(bound.capability, bound.period, bound.callerKey, attempt.controller.signal, continuation)
      const page = normalizeCashMovementArticleChoices(response, command)
      if (attempt.controller.signal.aborted || active.current !== attempt) return
      setStored(previous => {
        if (previous.scope !== scope) return previous
        if (!page.Available) return { ...empty(scope), available: false }
        const first = continuation === null, prior = first ? empty(scope) : previous
        const keys = new Set(prior.choices.map(choice => choice.Key))
        if (page.Choices.some(choice => keys.has(choice.Key)) || page.ContinuationKey !== null
          && (page.ContinuationKey === continuation || prior.seen.includes(page.ContinuationKey))) {
          return { ...empty(scope), error: 'Список статей змінився. Оновіть його та оберіть статтю знову.' }
        }
        return { ...prior, choices: [...prior.choices, ...page.Choices], continuation: page.ContinuationKey,
          seen: continuation === null ? [] : [...prior.seen, continuation], available: page.Available, loading: false }
      })
    } catch (error) {
      if (!attempt.controller.signal.aborted && active.current === attempt) setStored(previous => ({ ...empty(scope),
        error: error instanceof ApiError && error.status === 409 ? 'Список статей змінився. Оновіть його та оберіть статтю знову.'
          : error instanceof Error ? error.message : 'Не вдалося завантажити статті.', seen: previous.scope === scope ? previous.seen : [] }))
    } finally { if (active.current === attempt) active.current = null }
  }, [bound, eligible, scope])
  useEffect(() => {
    void load(null)
    return () => { const attempt = active.current; if (attempt?.scope === scope) { attempt.controller.abort(); active.current = null } }
  }, [load, scope])
  const refresh = () => { active.current?.controller.abort(); active.current = null; setRevision(previous => previous + 1) }
  const select = (key: string) => setStored(previous => previous.scope === scope && (key === '' || previous.available === true && previous.choices.some(choice => choice.Key === key))
    ? { ...previous, selected: key || null } : previous)
  const selectedKey = current.available === true && current.choices.some(choice => choice.Key === current.selected) ? current.selected : null
  const selectedCaption = current.choices.find(choice => choice.Key === selectedKey)?.Caption ?? null
  return { ...current, scope, eligible, selectedKey, selectedCaption, select, refresh, loadMore: () => { if (current.continuation && !current.loading) void load(current.continuation) } }
}
