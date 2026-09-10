import { useCallback, useRef, useState } from 'react'
import type { ReportResult } from '../types'

type ReportRunState<Outcome> = {
  result: ReportResult | null
  lastRun: Outcome | null
  error: string | null
  isLoading: boolean
  downloadModalOpened: boolean
}

function emptyRun<Outcome>(requestKey: string) {
  return {
    requestKey,
    scope: {},
    value: { result: null, lastRun: null, error: null, isLoading: false, downloadModalOpened: false } as ReportRunState<Outcome>,
  }
}

/** A changed request clears its files immediately and rejects late updates from the previous request. */
export function useReportRunState<Outcome>(requestKey: string) {
  const [stored, setStored] = useState(() => emptyRun<Outcome>(requestKey))
  const latestAttempt = useRef<object | null>(null)
  let current = stored
  if (stored.requestKey !== requestKey) {
    current = emptyRun<Outcome>(requestKey)
    setStored(current)
  }
  const scope = current.scope
  const update = useCallback((patch: Partial<ReportRunState<Outcome>>) => {
    setStored(previous => previous.scope === scope
      ? { ...previous, value: { ...previous.value, ...patch } }
      : previous)
  }, [scope])
  const begin = useCallback(() => {
    const attempt = {}
    latestAttempt.current = attempt
    const updateAttempt = (patch: Partial<ReportRunState<Outcome>>) => {
      setStored(previous => previous.scope === scope && latestAttempt.current === attempt
        ? { ...previous, value: { ...previous.value, ...patch } }
        : previous)
    }
    updateAttempt({ result: null, lastRun: null, error: null, isLoading: true, downloadModalOpened: false })
    return updateAttempt
  }, [scope])
  const clear = useCallback(() => {
    latestAttempt.current = null
    update({ result: null, lastRun: null, error: null, isLoading: false, downloadModalOpened: false })
  }, [update])
  return { ...current.value, update, begin, clear }
}
