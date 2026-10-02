import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { previewOverdueReceivables } from '../api/overdueReceivablesApi'
import { isOverdueReceivablesCapabilities, isOverdueReceivablesDocumentUrl, overdueReceivablesMonthError, type OverdueReceivablesCapabilities, type OverdueReceivablesReport } from '../data/overdueReceivables'
import { useReportRunState } from '../hooks/useReportRunState'
import { normalizeReportResult } from '../utils'
import { ServerReportCellsTable } from './ServerReportCellsTable'

export function OverdueReceivablesReportPanel({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: OverdueReceivablesCapabilities
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
  const run = useReportRunState<OverdueReceivablesReport>(requestKey)
  const monthError = overdueReceivablesMonthError(month)
  const executable = isOverdueReceivablesCapabilities(capability) && capability.RuntimeImplemented
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
      const response = await previewOverdueReceivables(capability, month, attempt.controller.signal)
      if (attempt.controller.signal.aborted) return
      if (!isOverdueReceivablesDocumentUrl(response.DocumentURL) || !isOverdueReceivablesDocumentUrl(response.PdfDocumentURL))
        throw new Error('Сервер повернув некоректне посилання на файл звіту.')
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
    <Text size="sm">{t('Прострочена дебіторська заборгованість на кінець місяця. Порівняння із залишками на кінець попереднього місяця. Суми в EUR за комерційними курсами системи.')}</Text>
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
    {report ? <OverdueReceivablesResult report={report} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={`${capability.ReportName}: ${report?.Month ?? month}`} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}

function OverdueReceivablesResult({ report }: { report: OverdueReceivablesReport }) {
  const { t } = useI18n()
  const unavailable = report.Cells.some(cell => !cell.Available) || report.Rows.some(row => row.Cells.some(cell => !cell.Available))
  return <section aria-label={t('Результат простроченої дебіторки')}>
    <Text size="sm">{t('Період')}: {report.Month}</Text>
    {report.Complete && !report.HasRows ? <Alert color="blue">{t('У вибраних періодах немає простроченої дебіторської заборгованості.')}</Alert> : null}
    <section aria-label={t('Підсумок')}><ServerReportCellsTable columns={report.Columns} cells={report.Cells} /></section>
    {report.Rows.length > 0 ? <OverdueReceivablesGroups report={report} /> : null}
    {!report.Complete ? <Alert color="yellow">{t('Звіт неповний: залишки, рухи, умови документів або валютні курси ще не підтверджені.')}</Alert> : null}
    {report.HasRows && unavailable ? <Alert color="yellow">{t('Не всі показники вдалося розрахувати.')}</Alert> : null}
  </section>
}

function OverdueReceivablesGroups({ report }: { report: OverdueReceivablesReport }) {
  const { t } = useI18n()
  return <Table.ScrollContainer minWidth={760}><Table aria-label={t('Контрагенти')}>
    <Table.Thead><Table.Tr><Table.Th>Контрагент</Table.Th>{report.Columns.map(column => <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
    <Table.Tbody>{report.Rows.map(row => <Table.Tr key={row.CounterpartyReference}>
      <Table.Td>{row.CounterpartyName ?? t('Назва недоступна')}</Table.Td>
      {row.Cells.map(cell => <Table.Td key={cell.Key} title={!cell.Available ? t('Недоступні дані') : cell.Value === null ? t('У періоді немає даних') : undefined}>
        {cell.FormattedValue ?? '—'}
      </Table.Td>)}
    </Table.Tr>)}</Table.Tbody>
  </Table></Table.ScrollContainer>
}
