import { useEffect, useRef, useState } from 'react'
import { previewManagementBalance } from '../api/managementBalanceApi'
import { initialManagementBalancePeriod, isManagementBalanceCapabilities, managementBalancePeriodError, managementBalanceKind,
  normalizeManagementBalanceReport, createManagementBalanceRequest,
  type ManagementBalanceCapabilities, type ManagementBalanceReport } from '../data/managementBalance'
import { normalizeReportResult } from '../utils'
import { useReportRunState } from './useReportRunState'

/** Local calendar edits and caller changes immediately invalidate the prior values, files and active request. */
export function useManagementBalanceReport({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: ManagementBalanceCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void
}) {
  const kind = managementBalanceKind(capability)!
  const [period, setPeriod] = useState(() => initialManagementBalancePeriod(kind, initialMonth))
  const requestKey = JSON.stringify([callerKey, canGenerate, capability, period])
  const active = useRef<{ requestKey: string; controller: AbortController; loading?: (value: boolean) => void } | null>(null)
  useEffect(() => () => {
    const attempt = active.current
    if (attempt?.requestKey === requestKey) { attempt.controller.abort(); active.current = null; attempt.loading?.(false) }
  }, [requestKey])
  const run = useReportRunState<ManagementBalanceReport>(requestKey)
  const periodError = managementBalancePeriodError(kind, period)
  const executable = isManagementBalanceCapabilities(capability) && capability.RuntimeImplemented
  const canSubmit = canGenerate && Boolean(callerKey) && executable && !periodError && !run.isLoading
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  async function generate(openFiles: boolean) {
    if (!canSubmit || !callerKey || active.current) return
    const attempt = { requestKey, controller: new AbortController(), loading: onLoadingChange }
    active.current = attempt; const updateAttempt = run.begin(); attempt.loading?.(true)
    try {
      const command = createManagementBalanceRequest(capability, period)
      const response = await previewManagementBalance(capability, command.Period, callerKey, attempt.controller.signal)
      if (attempt.controller.signal.aborted) return
      const report = normalizeManagementBalanceReport(response, command)
      const result = normalizeReportResult(report)
      updateAttempt({ result, lastRun: report, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      if (!attempt.controller.signal.aborted) updateAttempt({ error: error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally {
      updateAttempt({ isLoading: false })
      if (active.current === attempt) { active.current = null; attempt.loading?.(false) }
    }
  }
  return { kind, period, setPeriod, periodError, executable, canSubmit, run, hasFiles, generate }
}
