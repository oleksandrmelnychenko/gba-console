import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { previewOriginalRevenue } from '../api/originalRevenueApi'
import { isOriginalRevenueCapabilities, originalRevenueCellText, originalRevenueMonthError,
  type OriginalRevenueCapabilities, type OriginalRevenueReport, type OriginalRevenueTotals } from '../data/originalRevenue'
import { useReportRunState } from '../hooks/useReportRunState'
import { normalizeReportResult } from '../utils'

export function OriginalRevenueReportPanel({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: OriginalRevenueCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (loading: boolean) => void
}) {
  const { t } = useI18n()
  const [month, setMonth] = useState(initialMonth)
  const run = useReportRunState<OriginalRevenueReport>(JSON.stringify([callerKey, canGenerate, capability, month]))
  const error = originalRevenueMonthError(month)
  const executable = isOriginalRevenueCapabilities(capability) && capability.Executable
  const canSubmit = canGenerate && executable && !error && !run.isLoading
  const report = run.lastRun
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  async function generate(openFiles: boolean) {
    if (!canSubmit) return
    const updateAttempt = run.begin(); onLoadingChange?.(true)
    try {
      const response = await previewOriginalRevenue(capability, month)
      const result = normalizeReportResult(response)
      updateAttempt({ result, lastRun: response,
        downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (failure) {
      updateAttempt({ error: failure instanceof ApiError || failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт.' })
    } finally { updateAttempt({ isLoading: false }); onLoadingChange?.(false) }
  }
  return <Stack gap="md">
    <Text size="sm">{t('Оберіть місяць. Порівняння — з попереднім календарним місяцем.')}</Text>
    <Text size="sm" c="dimmed">{t('Виручка в EUR за нашими облікованими продажами та поверненнями, згрупована за контрагентами.')}</Text>
    <TextInput type="month" label={t('Місяць')} value={month} disabled={!canGenerate || run.isLoading}
      onChange={event => setMonth(event.currentTarget.value)} />
    {!canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {error ? <Alert color="yellow">{t(error)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading}
        onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {report ? <section aria-label={t('Результат виручки')}>
      <Text size="sm">{t('Поточний місяць')}: {report.CurrentPeriod.From.slice(0, 7)} · {t('Попередній місяць')}: {report.PreviousPeriod.From.slice(0, 7)} · EUR</Text>
      <Table.ScrollContainer minWidth={800}><Table>
        <Table.Thead><Table.Tr><Table.Th>{report.RowCaption}</Table.Th>{report.Columns.map(column =>
          <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
        <Table.Tbody>{report.Rows.map(row => <RevenueRow key={row.ClientId ?? 'unattributed'} label={row.Caption} row={row} report={report} />)}</Table.Tbody>
        <Table.Tfoot><RevenueRow label={t('Разом')} row={report.Totals} report={report} /></Table.Tfoot>
      </Table></Table.ScrollContainer>
      {!report.Rows.length ? <Text size="sm">{t('Продажів і повернень за обидва місяці немає.')}</Text> : null}
      {report.Rows.some(row => !row.Attributed) ? <Text size="sm">{t('Суми без визначеного контрагента включені до підсумку.')}</Text> : null}
      {report.Totals.Current.UnknownMoneyLines > 0 || report.Totals.Previous.UnknownMoneyLines > 0
        ? <Alert color="yellow">{t('Порожні клітинки позначають недоступні суми. Вони не прирівнюються до нуля; залежні підсумки залишаються недоступними.')}</Alert> : null}
      <Text size="sm">{t('Рядки без грошових даних')}: {t('Поточний місяць')} — {report.Totals.Current.UnknownMoneyLines}; {t('Попередній місяць')} — {report.Totals.Previous.UnknownMoneyLines}</Text>
    </section> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={`${capability.Title}: ${report?.Month ?? month}`} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function RevenueRow({ label, row, report }: { label: string; row: OriginalRevenueTotals; report: OriginalRevenueReport }) {
  const { t } = useI18n()
  return <Table.Tr><Table.Th scope="row">{label}</Table.Th>{row.Cells.map((cell, index) => <Table.Td key={cell.Key}
    title={cell.Available ? undefined : t('Недоступні дані')}>{originalRevenueCellText(cell.Value, report.Columns[index].DecimalPlaces)}</Table.Td>)}</Table.Tr>
}
