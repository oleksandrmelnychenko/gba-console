import { useLayoutEffect, useRef } from 'react'
import { readOriginalCashAvailability } from '../api/originalCashAvailabilityApi'
import { availabilityDateError, availabilityRequest, type AvailabilityCapability, type AvailabilityField, type AvailabilityFilter, type AvailabilityResult } from '../data/originalCashAvailability'
import { useReportRunState } from './useReportRunState'
export function useOriginalCashAvailability({ capability, callerKey, canGenerate, dateKon, filters, dimensions, management, key, receive }: {
  capability: AvailabilityCapability; callerKey: string | null; canGenerate: boolean; dateKon: string; filters: AvailabilityFilter[]; dimensions: AvailabilityField[]; management: boolean; key: string; receive: (result: AvailabilityResult) => void
}) {
  const run = useReportRunState<AvailabilityResult>(key), active = useRef<AbortController | null>(null)
  useLayoutEffect(() => () => { active.current?.abort(); active.current = null }, [key])
  const allowed = canGenerate && !!callerKey && capability.Executable, dateError = availabilityDateError(dateKon)
  function invalidate() { active.current?.abort(); active.current = null; run.clear() }
  async function generate() {
    if (!allowed || dateError || run.isLoading) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    const update = run.begin()
    try {
      const result = await readOriginalCashAvailability(availabilityRequest(capability, dateKon, filters, dimensions, management), controller.signal)
      if (controller.signal.aborted || active.current !== controller) return
      update({ lastRun: result }); receive(result)
    } catch (failure) {
      if (!controller.signal.aborted && active.current === controller) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт доступних коштів.' })
    } finally { update({ isLoading: false }) }
  }
  return { ...run, allowed, dateError, invalidate, generate }
}
