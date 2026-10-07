import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { usePlannedCashScenarioChoices } from './usePlannedCashScenarioChoices'
import { previewPlannedCash } from '../api/plannedCashApi'
import { isPlannedCashCapabilities, plannedCashFilterError, normalizePlannedCashReport, createPlannedCashRequest,
  type PlannedCashCapabilities, type PlannedCashFilters, type PlannedCashReport } from '../data/plannedCash'
import { normalizeReportResult } from '../utils'
import { useReportRunState } from './useReportRunState'

/** One immutable form/filter/owner scope controls inline values and same-run exports. */
export function usePlannedCashReport({ capability, initialFilters, canGenerate, callerKey, onLoadingChange }: {
  capability: PlannedCashCapabilities; initialFilters: PlannedCashFilters; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void
}) {
  const [filters, setFilters] = useState(initialFilters)
  const choices = usePlannedCashScenarioChoices({ capability, filters, canGenerate, callerKey })
  const requestKey = JSON.stringify([callerKey, canGenerate, capability, filters, choices.scope, choices.selectedKey])
  const active = useRef<{ requestKey: string; controller: AbortController; loading?: (value: boolean) => void } | null>(null)
  useEffect(() => () => {
    const attempt = active.current
    if (attempt?.requestKey === requestKey) { attempt.controller.abort(); active.current = null; attempt.loading?.(false) }
  }, [requestKey])
  const run = useReportRunState<PlannedCashReport>(requestKey)
  const filterError = plannedCashFilterError(capability, filters, choices.selectedKey)
  const executable = isPlannedCashCapabilities(capability) && capability.RuntimeImplemented
  const canSubmit = canGenerate && Boolean(callerKey) && executable && !filterError && !run.isLoading
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  const change = (key: keyof PlannedCashFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value }))
  async function generate(openFiles: boolean) {
    if (!canSubmit || !callerKey || active.current) return
    const attempt = { requestKey, controller: new AbortController(), loading: onLoadingChange }
    active.current = attempt; const updateAttempt = run.begin(); attempt.loading?.(true)
    try {
      const command = createPlannedCashRequest(capability, filters, choices.selectedKey)
      const response = await (capability.RequiresObservedScenario
        ? previewPlannedCash(capability, { ...filters }, callerKey, attempt.controller.signal, choices.selectedKey)
        : previewPlannedCash(capability, { ...filters }, callerKey, attempt.controller.signal))
      if (attempt.controller.signal.aborted) return
      const report = normalizePlannedCashReport(response, command), result = normalizeReportResult(report)
      updateAttempt({ result, lastRun: report, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      if (!attempt.controller.signal.aborted) {
        if (capability.RequiresObservedScenario && error instanceof ApiError && error.status === 409) choices.refresh()
        else updateAttempt({ error: error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
      }
    } finally {
      updateAttempt({ isLoading: false })
      if (active.current === attempt) { active.current = null; attempt.loading?.(false) }
    }
  }
  return { choices, filters, change, filterError, executable, canSubmit, run, hasFiles, generate }
}
