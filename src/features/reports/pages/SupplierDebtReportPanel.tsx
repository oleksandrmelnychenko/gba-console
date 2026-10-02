import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { previewSupplierDebt } from '../api/supplierDebtApi'
import { isSupplierDebtCapabilities, supplierDebtMonthError, type SupplierDebtCapabilities, type SupplierDebtReport } from '../data/supplierDebt'
import { useReportRunState } from '../hooks/useReportRunState'
import { normalizeReportResult } from '../utils'

export function SupplierDebtReportPanel({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: SupplierDebtCapabilities
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
  const run = useReportRunState<SupplierDebtReport>(requestKey)
  const monthError = supplierDebtMonthError(month)
  const executable = isSupplierDebtCapabilities(capability) && capability.RuntimeImplemented
  const canSubmit = canGenerate && executable && !monthError && !run.isLoading
  const report = run.lastRun
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)

  async function generate(openFiles: boolean) {
    if (!canSubmit || active.current) return
    const attempt = { requestKey, controller: new AbortController(), loading: onLoadingChange }
    active.current = attempt
    const updateAttempt = run.begin()
    onLoadingChange?.(true)
    try {
      const response = await previewSupplierDebt(capability, month, attempt.controller.signal)
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
    <Text size="sm">{t('Заборгованість перед постачальниками на кінець місяця з поточних даних GBA. Порівняння із залишками на кінець попереднього місяця.')}</Text>
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
    {report ? <SupplierDebtResult report={report} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={`${capability.ReportName}: ${report?.Month ?? month}`} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}

function SupplierDebtResult({ report }: { report: SupplierDebtReport }) {
  const { t } = useI18n()
  const unavailable = report.Cells.some(cell => !cell.Available)
  return <section aria-label={t('Результат заборгованості постачальникам')}>
    <Text size="sm">{t('Період')}: {report.Month}</Text>
    {report.Complete && !report.HasRows ? <Alert color="blue">{t('У вибраних періодах немає заборгованості перед постачальниками.')}</Alert> : null}
    <Table.ScrollContainer minWidth={640}>
      <Table>
        <Table.Thead><Table.Tr>{report.Columns.map(column => <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
        <Table.Tbody><Table.Tr>{report.Cells.map(cell => <Table.Td key={cell.Key}
          title={!cell.Available ? t('Недоступні дані') : cell.Value === null ? t('У періоді немає даних') : undefined}>
          {cell.FormattedValue ?? '—'}
        </Table.Td>)}</Table.Tr></Table.Tbody>
      </Table>
    </Table.ScrollContainer>
    {!report.Complete ? <Alert color="yellow">{t('Звіт неповний: початкові залишки або рухи за вибрані періоди ще не підтверджені.')}</Alert> : null}
    {report.HasRows && unavailable ? <Alert color="yellow">{t('Не всі показники вдалося розрахувати.')}</Alert> : null}
  </section>
}
