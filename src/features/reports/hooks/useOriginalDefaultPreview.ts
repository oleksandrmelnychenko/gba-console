import { useEffect, useRef } from 'react'
import { useReportRunState } from './useReportRunState'

/** Shared request ownership for the client default and cash-flow default forms. */
export function useOriginalDefaultPreview<Result>(key: string, allowed: boolean, periodError: string | null,
  read: (signal: AbortSignal) => Promise<Result>, receive?: (result: Result) => void) {
  const run = useReportRunState<Result>(key), active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [key])
  function invalidate() { active.current?.abort(); run.clear() }
  async function generate() {
    if (!allowed || periodError || run.isLoading) return
    active.current?.abort()
    const controller = new AbortController(); active.current = controller
    const update = run.begin()
    try {
      const result = await read(controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: result }); receive?.(result)
    } catch (error) {
      if (!controller.signal.aborted) update({ error: error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally { update({ isLoading: false }) }
  }
  return { ...run, invalidate, generate }
}
