import { useEffect, useRef, useState } from 'react'
import { previewManagementReturns } from '../api/managementReturnsApi'
import { initialManagementReturnsWindows, isManagementReturnsCapabilities, managementReturnsWindowsError,
  normalizeManagementReturnsReport, createManagementReturnsRequest,
  type ManagementReturnsCapabilities, type ManagementReturnsReport } from '../data/managementReturns'
import { normalizeReportResult } from '../utils'
import { useReportRunState } from './useReportRunState'

/** Local calendar edits and caller changes immediately invalidate the prior values, files and active request. */
export function useManagementReturnsReport({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: ManagementReturnsCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void
}) {
  const [windows, setWindows] = useState(() => initialManagementReturnsWindows(initialMonth))
  const requestKey = JSON.stringify([callerKey, canGenerate, capability, windows])
  const active = useRef<{ requestKey: string; controller: AbortController; loading?: (value: boolean) => void } | null>(null)
  useEffect(() => () => {
    const attempt = active.current
    if (attempt?.requestKey === requestKey) { attempt.controller.abort(); active.current = null; attempt.loading?.(false) }
  }, [requestKey])
  const run = useReportRunState<ManagementReturnsReport>(requestKey)
  const periodError = managementReturnsWindowsError(windows)
  const executable = isManagementReturnsCapabilities(capability) && capability.RuntimeImplemented
  const canSubmit = canGenerate && Boolean(callerKey) && executable && !periodError && !run.isLoading
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  async function generate(openFiles: boolean) {
    if (!canSubmit || !callerKey || active.current) return
    const attempt = { requestKey, controller: new AbortController(), loading: onLoadingChange }
    active.current = attempt; const updateAttempt = run.begin(); attempt.loading?.(true)
    try {
      const command = createManagementReturnsRequest(capability, windows)
      const response = await previewManagementReturns(capability,
        { CurrentPeriod: command.CurrentPeriod, PreviousPeriod: command.PreviousPeriod }, callerKey, attempt.controller.signal)
      if (attempt.controller.signal.aborted) return
      const report = normalizeManagementReturnsReport(response, command)
      const result = normalizeReportResult(report)
      updateAttempt({ result, lastRun: report, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      if (!attempt.controller.signal.aborted) updateAttempt({ error: error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally {
      updateAttempt({ isLoading: false })
      if (active.current === attempt) { active.current = null; attempt.loading?.(false) }
    }
  }
  return { windows, setWindows, periodError, executable, canSubmit, run, hasFiles, generate }
}
