import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { previewCurrencyRateDynamics } from '../api/currencyRateDynamicsApi'
import { currencyRateDynamicsCellText, currencyRateDynamicsDefinitionLabel, currencyRateDynamicsMonthError,
  isCurrencyRateDynamicsCapabilities, type CurrencyRateDynamicsCapabilities, type CurrencyRateDynamicsDefinition,
  type CurrencyRateDynamicsReport } from '../data/currencyRateDynamics'
import { useReportRunState } from '../hooks/useReportRunState'
import { normalizeReportResult } from '../utils'
import { CurrencyRateDynamicsRatePicker } from './CurrencyRateDynamicsRatePicker'

export function CurrencyRateDynamicsReportPanel({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: CurrencyRateDynamicsCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (loading: boolean) => void
}) {
  const { t } = useI18n()
  const [month, setMonth] = useState(initialMonth)
  const [definition, setDefinition] = useState<CurrencyRateDynamicsDefinition | null>(null)
  const run = useReportRunState<CurrencyRateDynamicsReport>(JSON.stringify([callerKey, canGenerate, capability, month, definition]))
  const monthError = currencyRateDynamicsMonthError(month)
  const executable = isCurrencyRateDynamicsCapabilities(capability) && capability.Executable
  const canSubmit = canGenerate && executable && !monthError && definition !== null && !run.isLoading
  const report = run.lastRun
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  async function generate(openFiles: boolean) {
    if (!canSubmit || !definition) return
    const updateAttempt = run.begin(); onLoadingChange?.(true)
    try {
      const response = await previewCurrencyRateDynamics(capability, month, definition)
      const result = normalizeReportResult(response)
      updateAttempt({ result, lastRun: response,
        downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      updateAttempt({ error: error instanceof ApiError || error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally { updateAttempt({ isLoading: false }); onLoadingChange?.(false) }
  }
  return <Stack gap="md">
    <Text size="sm">{t('Оберіть місяць і валютну пару. Попередній період — попередній календарний місяць.')}</Text>
    <Text size="sm" c="dimmed">{t('Показуються наші комерційні курси на кінець кожного місяця, включно з внесеними вручну.')}</Text>
    <TextInput type="month" label={t('Період')} value={month} disabled={!canGenerate || run.isLoading}
      onChange={event => setMonth(event.currentTarget.value)} />
    <CurrencyRateDynamicsRatePicker value={definition} enabled={canGenerate && executable && !run.isLoading}
      callerKey={callerKey} onChange={setDefinition} />
    {!canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {monthError ? <Alert color="yellow">{t(monthError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading}
        onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {report ? <section aria-label={t('Результат динаміки курсу базової валюти')}>
      <Text size="sm">{t('Період')}: {report.Month}</Text>
      <Text size="sm">{currencyRateDynamicsDefinitionLabel(report.RateDefinition)}</Text>
      <Table.ScrollContainer minWidth={640}><Table>
        <Table.Thead><Table.Tr>{report.Columns.map(column => <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
        <Table.Tbody><Table.Tr>{report.Cells.map((cell, index) => <Table.Td key={cell.Key}
          title={cell.Available ? undefined : t('Недоступні дані')}>{currencyRateDynamicsCellText(cell.Value, report.Columns[index].DecimalPlaces)}</Table.Td>)}</Table.Tr></Table.Tbody>
      </Table></Table.ScrollContainer>
      {report.Cells.some(cell => !cell.Available) ? <Alert color="yellow">{t('Порожні клітинки позначають недоступні значення розрахунку.')}</Alert> : null}
      <RateHistoryAvailability report={report} />
    </section> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={`${capability.Title}: ${report?.Month ?? month}`} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function RateHistoryAvailability({ report }: { report: CurrencyRateDynamicsReport }) {
  const { t } = useI18n()
  const labels = { Current: 'Поточний місяць', Previous: 'Попередній місяць' }
  return <Stack gap="xs">
    {(Object.keys(labels) as Array<keyof typeof labels>).filter(key => !report.Inputs[key].Available).map(key =>
      <Text key={key} size="sm">{t(labels[key])}: {t(report.Inputs[key].Code === 'latest_point_ambiguous'
        ? 'Кілька курсів мають однакову останню дату.' : 'Немає історії курсу на цю дату.')}</Text>)}
    {report.CalculationCode === 'percentage_range_unavailable'
      ? <Text size="sm">{t('Не вдалося розрахувати відсоткову зміну. Курси й різниця доступні.')}</Text> : null}
  </Stack>
}
