import { useEffect, useRef, useState } from 'react'
import { previewCurrentLiquidity } from '../api/currentLiquidityApi'
import { isCurrentLiquidityCapabilities, currentLiquidityEndpointError, normalizeCurrentLiquidityReport, createCurrentLiquidityRequest,
  type CurrentLiquidityCapabilities, type CurrentLiquidityEndpoints, type CurrentLiquidityReport } from '../data/currentLiquidity'
import { normalizeReportResult } from '../utils'
import { useReportRunState } from './useReportRunState'

/** Scope and caller changes clear stale values/files and cancel their stream. */
export function useCurrentLiquidityReport({ capability, initialEndpoints, canGenerate, callerKey, onLoadingChange }: {
  capability: CurrentLiquidityCapabilities; initialEndpoints: CurrentLiquidityEndpoints; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void
}) {
  const [current, setCurrent] = useState(initialEndpoints.CurrentEndpoint), [previous, setPrevious] = useState(initialEndpoints.PreviousEndpoint)
  const requestKey = JSON.stringify([callerKey, canGenerate, capability, current, previous])
  const active = useRef<{ requestKey: string; controller: AbortController; loading?: (value: boolean) => void } | null>(null)
  useEffect(() => () => {
    const attempt = active.current
    if (attempt?.requestKey === requestKey) { attempt.controller.abort(); active.current = null; attempt.loading?.(false) }
  }, [requestKey])
  const run = useReportRunState<CurrentLiquidityReport>(requestKey)
  const endpointError = currentLiquidityEndpointError(current, previous)
  const executable = isCurrentLiquidityCapabilities(capability) && capability.RuntimeImplemented
  const canSubmit = canGenerate && Boolean(callerKey) && executable && !endpointError && !run.isLoading
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  async function generate(openFiles: boolean) {
    if (!canSubmit || !callerKey || active.current) return
    const attempt = { requestKey, controller: new AbortController(), loading: onLoadingChange }
    active.current = attempt; const updateAttempt = run.begin(); attempt.loading?.(true)
    try {
      const command = createCurrentLiquidityRequest(capability, current, previous)
      const response = await previewCurrentLiquidity(capability, command.CurrentEndpoint, command.PreviousEndpoint, callerKey, attempt.controller.signal)
      if (attempt.controller.signal.aborted) return
      const report = normalizeCurrentLiquidityReport(response, command), result = normalizeReportResult(report)
      updateAttempt({ result, lastRun: report, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      if (!attempt.controller.signal.aborted) updateAttempt({ error: error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally {
      updateAttempt({ isLoading: false })
      if (active.current === attempt) { active.current = null; attempt.loading?.(false) }
    }
  }
  return { current, setCurrent, previous, setPrevious, endpointError, executable, canSubmit, run, hasFiles, generate }
}
