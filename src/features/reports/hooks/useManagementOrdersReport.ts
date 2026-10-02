import { useEffect, useRef, useState } from 'react'
import { previewManagementOrders } from '../api/managementOrdersApi'
import { isManagementOrdersCapabilities, managementOrdersMonthError,
  normalizeManagementOrdersReport, createManagementOrdersRequest,
  type ManagementOrdersCapabilities, type ManagementOrdersReport } from '../data/managementOrders'
import { normalizeReportResult } from '../utils'
import { useReportRunState } from './useReportRunState'

/** Local calendar edits and caller changes immediately invalidate the prior values, files and active request. */
export function useManagementOrdersReport({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: ManagementOrdersCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void
}) {
  const [month, setMonth] = useState(initialMonth)
  const requestKey = JSON.stringify([callerKey, canGenerate, capability, month])
  const active = useRef<{ requestKey: string; controller: AbortController; loading?: (value: boolean) => void } | null>(null)
  useEffect(() => () => {
    const attempt = active.current
    if (attempt?.requestKey === requestKey) { attempt.controller.abort(); active.current = null; attempt.loading?.(false) }
  }, [requestKey])
  const run = useReportRunState<ManagementOrdersReport>(requestKey)
  const monthError = managementOrdersMonthError(month)
  const executable = isManagementOrdersCapabilities(capability) && capability.RuntimeImplemented
  const canSubmit = canGenerate && Boolean(callerKey) && executable && !monthError && !run.isLoading
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  async function generate(openFiles: boolean) {
    if (!canSubmit || !callerKey || active.current) return
    const attempt = { requestKey, controller: new AbortController(), loading: onLoadingChange }
    active.current = attempt; const updateAttempt = run.begin(); attempt.loading?.(true)
    try {
      const command = createManagementOrdersRequest(capability, month)
      const response = await previewManagementOrders(capability, command.Month, callerKey, attempt.controller.signal)
      if (attempt.controller.signal.aborted) return
      const report = normalizeManagementOrdersReport(response, command)
      const result = normalizeReportResult(report)
      updateAttempt({ result, lastRun: report, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      if (!attempt.controller.signal.aborted) updateAttempt({ error: error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally {
      updateAttempt({ isLoading: false })
      if (active.current === attempt) { active.current = null; attempt.loading?.(false) }
    }
  }
  return { month, setMonth, monthError, executable, canSubmit, run, hasFiles, generate }
}
