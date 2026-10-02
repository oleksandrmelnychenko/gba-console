import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useCashMovementArticleChoices } from './useCashMovementArticleChoices'
import { previewCashMovement } from '../api/cashMovementApi'
import { cashMovementKind, cashMovementPeriodError, initialCashMovementPeriod, isCashMovementCapabilities,
  createCashMovementRequest, normalizeCashMovementReport, type CashMovementCapabilities, type CashMovementReport } from '../data/cashMovement'
import { normalizeReportResult } from '../utils'
import { useReportRunState } from './useReportRunState'

/** Owns a single caller/period request and its cancellation and file scope. */
export function useCashMovementReport({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: CashMovementCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (loading: boolean) => void
}) {
  const kind = cashMovementKind(capability)
  const [period, setPeriod] = useState(() => initialCashMovementPeriod(kind ?? 'receipts', initialMonth))
  const choices = useCashMovementArticleChoices({ capability, period, canGenerate, callerKey })
  const requestKey = JSON.stringify([callerKey, canGenerate, capability, period, choices.scope, choices.selectedKey])
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
  const canSubmit = canGenerate && Boolean(callerKey) && executable && !periodError && !run.isLoading
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  async function generate(openFiles: boolean) {
    if (!canSubmit || !callerKey || active.current) return
    const attempt = { requestKey, controller: new AbortController(), loading: onLoadingChange }
    active.current = attempt
    const updateAttempt = run.begin()
    onLoadingChange?.(true)
    try {
      const command = createCashMovementRequest(capability, period, choices.selectedKey)
      const response = await previewCashMovement(capability, period, callerKey, attempt.controller.signal, choices.selectedKey)
      if (attempt.controller.signal.aborted) return
      const report = normalizeCashMovementReport(response, command)
      if (choices.selectedKey && report.ArticleFilter?.Caption !== choices.selectedCaption) throw new Error('Відбір звіту змінився. Оновіть список статей.')
      const result = normalizeReportResult(report)
      updateAttempt({ result, lastRun: report, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      if (!attempt.controller.signal.aborted) {
        if (choices.selectedKey && error instanceof ApiError && error.status === 409) choices.refresh()
        else updateAttempt({ error: error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
      }
    } finally {
      updateAttempt({ isLoading: false })
      if (active.current === attempt) { active.current = null; attempt.loading?.(false) }
    }
  }
  return { choices, kind, period, setPeriod, periodError, executable, canSubmit, run, hasFiles, generate }
}
