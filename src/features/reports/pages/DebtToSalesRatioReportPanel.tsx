import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { previewDebtToSalesRatio } from '../api/debtToSalesRatioApi'
import {
  debtToSalesRatioCellText,
  debtToSalesRatioMonthError,
  isDebtToSalesRatioCapabilities,
  type DebtToSalesRatioCapabilities,
  type DebtToSalesRatioReport,
} from '../data/debtToSalesRatio'
import { useReportRunState } from '../hooks/useReportRunState'
import { normalizeReportResult } from '../utils'

export function DebtToSalesRatioReportPanel({ capability, initialMonth, canGenerate, onLoadingChange }: {
  capability: DebtToSalesRatioCapabilities
  initialMonth: string
  canGenerate: boolean
  onLoadingChange?: (loading: boolean) => void
}) {
  const { t } = useI18n()
  const [month, setMonth] = useState(initialMonth)
  const run = useReportRunState<DebtToSalesRatioReport>(JSON.stringify([canGenerate, capability, month]))
  const monthError = debtToSalesRatioMonthError(month)
  const executable = isDebtToSalesRatioCapabilities(capability) && capability.Executable
  const canSubmit = canGenerate && executable && !monthError && !run.isLoading
  const report = run.lastRun
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)

  async function generate(openFiles: boolean) {
    if (!canSubmit) return
    const updateAttempt = run.begin()
    onLoadingChange?.(true)
    try {
      const response = await previewDebtToSalesRatio(capability, month)
      const result = normalizeReportResult(response)
      updateAttempt({ result, lastRun: response, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      updateAttempt({ error: error instanceof ApiError || error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally {
      updateAttempt({ isLoading: false })
      onLoadingChange?.(false)
    }
  }

  return <Stack gap="md">
    <Text size="sm">{t('Виберіть місячний період. Попередній період — попередній календарний місяць.')}</Text>
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
    {report ? <section aria-label={t('Результат оригінального конструктора')}>
      <Text size="sm">{t('Період')}: {report.Month}</Text>
      <Table.ScrollContainer minWidth={640}>
        <Table>
          <Table.Thead><Table.Tr>{report.Columns.map(column => <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
          <Table.Tbody><Table.Tr>{report.Cells.map((cell, index) => <Table.Td key={cell.Key}
            title={cell.Available ? undefined : t('Недоступні дані')}>
            {debtToSalesRatioCellText(cell.Value, report.Columns[index].DecimalPlaces)}
          </Table.Td>)}</Table.Tr></Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {report.Cells.some(cell => !cell.Available) ? <Alert color="yellow">{t('Порожні клітинки позначають недоступні значення розрахунку.')}</Alert> : null}
      <UnavailableInputs report={report} />
    </section> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={`${capability.Title}: ${report?.Month ?? month}`} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}

function UnavailableInputs({ report }: { report: DebtToSalesRatioReport }) {
  const { t } = useI18n()
  const labels = {
    CurrentDebt: 'Обороти дебіторки за поточний місяць',
    PreviousDebt: 'Обороти дебіторки за попередній місяць',
    CurrentSales: 'Обороти продажів за поточний місяць',
  }
  const unavailable = (Object.keys(labels) as Array<keyof typeof labels>).filter(key => !report.Inputs[key].Available)
  return unavailable.length ? <Text size="sm">{t('Недоступні дані')}: {unavailable.map(key => t(labels[key])).join('; ')}.</Text> : null
}
