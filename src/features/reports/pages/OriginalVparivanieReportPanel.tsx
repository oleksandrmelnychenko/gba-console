import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getOriginalMatrixCapability, getOriginalMatrixScopeBinding, readScopedOriginalMatrix } from '../api/originalVparivanieApi'
import type { MatrixResult } from '../data/originalVparivanie'
import { originalMatrixCsv, originalMatrixXlsx } from '../data/originalVparivanieExport'
import { matrixScopeAccepted, originalMatrixScope, type MatrixScope } from '../data/originalVparivanieScope'
import { useReportRunState } from '../hooks/useReportRunState'
import type { ReportRequestBody } from '../types'
import { OriginalVparivanieMatrix } from './OriginalVparivanieMatrix'

async function readAdmittedMatrix(scope: MatrixScope, signal: AbortSignal) {
  const capability = await getOriginalMatrixCapability(signal)
  const binding = await getOriginalMatrixScopeBinding(capability, scope, signal)
  if (!binding.AcceptanceProofSha256 || !binding.AcceptedInputWitnessSha256)
    throw new Error('Оригінальна матриця для цієї групи та періоду ще проходить звірку з 1С.')
  return readScopedOriginalMatrix(binding, signal)
}

function downloadMatrixFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  try {
    link.href = url; link.download = filename
    document.body.append(link); link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

function scopeState(request: ReportRequestBody): { scope: MatrixScope | null; error: string | null } {
  try { return { scope: originalMatrixScope(request), error: null } }
  catch (cause) { return { scope: null, error: cause instanceof Error ? cause.message : 'Некоректний відбір матриці.' } }
}

export function OriginalVparivanieReportPanel({ request, enabled, disabled, callerKey }: {
  request: ReportRequestBody; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n()
  const key = JSON.stringify([request, enabled, callerKey])
  const run = useReportRunState<MatrixResult>(key)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => { active.current?.abort() }, [key])
  const { scope, error: scopeError } = scopeState(request)
  const canRead = enabled && !disabled && !run.isLoading && scope !== null
  const result = run.lastRun
  const canExport = enabled && !disabled && !run.isLoading && result !== null && matrixScopeAccepted(result)

  async function generate() {
    if (!canRead || !scope) return
    active.current?.abort()
    const controller = new AbortController(); active.current = controller
    const update = run.begin()
    try {
      const matrix = await readAdmittedMatrix(scope, controller.signal)
      if (!controller.signal.aborted) update({ lastRun: matrix })
    } catch (cause) {
      if (!controller.signal.aborted) update({ error: cause instanceof Error ? cause.message : 'Не вдалося сформувати матрицю.' })
    } finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }

  async function exportFile(format: 'csv' | 'xlsx') {
    if (!canExport || !result) return
    active.current?.abort()
    const controller = new AbortController(); active.current = controller
    run.update({ isLoading: true, error: null })
    try {
      const blob = format === 'csv' ? new Blob([originalMatrixCsv(result)], { type: 'text/csv;charset=utf-8' }) : await originalMatrixXlsx(result)
      if (controller.signal.aborted) return
      downloadMatrixFile(blob, `original-vparivanie-${result.From}-${result.Through}.${format}`)
    } catch (cause) {
      if (!controller.signal.aborted) run.update({ error: cause instanceof Error ? cause.message : 'Не вдалося сформувати файл матриці.' })
    } finally { if (!controller.signal.aborted) run.update({ isLoading: false }) }
  }

  return <section className="app-section-card" aria-label={t('Оригінальна матриця 1С')}><Stack gap="sm">
    <Text component="h2" fw={600} size="sm">{t('Оригінальна матриця 1С')}</Text>
    <Text size="sm">{t('Група та період беруться з поточних налаштувань звіту. Перегляд і Excel зберігають порядок колонок та порожні клітинки оригінальної форми.')}</Text>
    {scopeError ? <Alert color="yellow">{t(scopeError)}</Alert> : null}
    {!enabled ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group><Button type="button" variant="light" disabled={!canRead} loading={run.isLoading}
      onClick={() => { void generate() }}>{t('Переглянути оригінальну матрицю')}</Button>
      <Button type="button" disabled={!canExport}
        onClick={() => { void exportFile('xlsx') }}>{t('Оригінальна матриця Excel')}</Button>
      <Button type="button" variant="light" disabled={!canExport}
        onClick={() => { void exportFile('csv') }}>{t('Оригінальна матриця CSV')}</Button></Group>
    {result ? <OriginalVparivanieMatrix result={result} /> : null}
  </Stack></section>
}
