import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { previewEmployeeGrossProfit } from '../api/employeeGrossProfitApi'
import { isEmployeeGrossProfitCapabilities, employeeGrossProfitMonthError, type EmployeeGrossProfitCapabilities, type EmployeeGrossProfitReport } from '../data/employeeGrossProfit'
import { useReportRunState } from '../hooks/useReportRunState'
import { normalizeReportResult } from '../utils'
import { ServerReportCellsTable } from './ServerReportCellsTable'

export function EmployeeGrossProfitReportPanel({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: EmployeeGrossProfitCapabilities
  initialMonth: string
  canGenerate: boolean
  callerKey: string | null
  onLoadingChange?: (loading: boolean) => void
}) {
  const { t } = useI18n()
  const [month, setMonth] = useState(initialMonth)
  const requestKey = JSON.stringify([callerKey, canGenerate, capability, month])
  const active = useRef<{ requestKey: string; controller: AbortController; loading?: (value: boolean) => void } | null>(null)
  useEffect(() => () => {
    const attempt = active.current
    if (attempt?.requestKey === requestKey) {
      attempt.controller.abort()
      active.current = null
      attempt.loading?.(false)
    }
  }, [requestKey])
  const run = useReportRunState<EmployeeGrossProfitReport>(requestKey)
  const monthError = employeeGrossProfitMonthError(month)
  const executable = isEmployeeGrossProfitCapabilities(capability) && capability.RuntimeImplemented
  const canSubmit = canGenerate && Boolean(callerKey) && executable && !monthError && !run.isLoading
  const report = run.lastRun
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)

  async function generate(openFiles: boolean) {
    if (!canSubmit || !callerKey || active.current) return
    const attempt = { requestKey, controller: new AbortController(), loading: onLoadingChange }
    active.current = attempt
    const updateAttempt = run.begin()
    onLoadingChange?.(true)
    try {
      const response = await previewEmployeeGrossProfit(capability, month, callerKey, attempt.controller.signal)
      if (attempt.controller.signal.aborted) return
      const result = normalizeReportResult(response)
      updateAttempt({ result, lastRun: response, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      if (!attempt.controller.signal.aborted) updateAttempt({ error: error instanceof ApiError || error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally {
      updateAttempt({ isLoading: false })
      if (active.current === attempt) {
        active.current = null
        attempt.loading?.(false)
      }
    }
  }

  return <Stack gap="md">
    <Text size="sm">{t('Валовий прибуток на співробітника з поточних даних GBA за вибраний та попередній місяці. Управлінський ресурс (Упр), без валютної конвертації.')}</Text>
    <Text size="xs" c="dimmed">{t('Кількість співробітників визначається з активних записів історії на кінцеву межу кожного періоду.')}</Text>
    <TextInput type="month" label={t('Період')} value={month} disabled={!canGenerate || run.isLoading}
      onChange={event => setMonth(event.currentTarget.value)} />
    {!canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {monthError ? <Alert color="yellow">{t(monthError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {report ? <EmployeeGrossProfitResult report={report} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={`${capability.ReportName}: ${report?.Month ?? month}`} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}

function EmployeeGrossProfitResult({ report }: { report: EmployeeGrossProfitReport }) {
  const { t } = useI18n()
  const unavailable = report.Cells.some(cell => !cell.Available)
  return <section aria-label={t('Результат прибутку на співробітника')}>
    <Text size="sm">{t('Період')}: {report.Month}</Text>
    <Text size="sm">{t('Управлінський ресурс (Упр) на співробітника; без валютної конвертації.')}</Text>
    {report.Complete && !report.HasRows ? <Alert color="blue">{t('Підтверджено відсутність рядків у вибраних періодах; значення 0 і 100% збережені за правилом звіту.')}</Alert> : null}
    <ServerReportCellsTable columns={report.Columns} cells={report.Cells} />
    {!report.InputsComplete ? <Alert color="yellow">{t('Звіт неповний: публікації продажів, собівартості або історії співробітників ще не підтверджені. Порожні клітинки не означають нуль.')}</Alert> : null}
    {report.InputsComplete && unavailable ? <Alert color="yellow">{t('Не всі показники вдалося розрахувати.')}</Alert> : null}
  </section>
}
