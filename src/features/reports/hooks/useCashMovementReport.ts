import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { previewCashMovement } from '../api/cashMovementApi'
import { cashMovementKind, cashMovementPeriodError, initialCashMovementPeriod, isCashMovementCapabilities,
  type CashMovementCapabilities, type CashMovementReport } from '../data/cashMovement'
import { normalizeReportResult } from '../utils'
import { useReportRunState } from './useReportRunState'

/** Owns a single caller/period request and its cancellation and file scope. */
export function useCashMovementReport({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: CashMovementCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (loading: boolean) => void
}) {
  const kind = cashMovementKind(capability)
  const [period, setPeriod] = useState(() => initialCashMovementPeriod(kind ?? 'receipts', initialMonth))
  const requestKey = JSON.stringify([callerKey, canGenerate, capability, period])
  const active = useRef<{ requestKey: string; controller: AbortController; loading?: (value: boolean) => void } | null>(null)
  useEffect(() => () => {
    const attempt = active.current
    if (attempt?.requestKey === requestKey) {
      attempt.controller.abort(); active.current = null; attempt.loading?.(false)
    }
  }, [requestKey])
  const run = useReportRunState<CashMovementReport>(requestKey)
  const periodError = kind ? cashMovementPeriodError(kind, period) : 'Оберіть точну форму руху коштів.'
  const executable = isCashMovementCapabilities(capability) && capability.Executable
  const canSubmit = canGenerate && executable && !periodError && !run.isLoading
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  async function generate(openFiles: boolean) {
    if (!canSubmit || active.current) return
    const attempt = { requestKey, controller: new AbortController(), loading: onLoadingChange }
    active.current = attempt
    const updateAttempt = run.begin()
    onLoadingChange?.(true)
    try {
      const response = await previewCashMovement(capability, period, attempt.controller.signal)
      if (attempt.controller.signal.aborted) return
      const result = normalizeReportResult(response)
      updateAttempt({ result, lastRun: response, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      if (!attempt.controller.signal.aborted) updateAttempt({ error: error instanceof ApiError || error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally {
      updateAttempt({ isLoading: false })
      if (active.current === attempt) { active.current = null; attempt.loading?.(false) }
    }
  }
  return { kind, period, setPeriod, periodError, executable, canSubmit, run, hasFiles, generate }
}
