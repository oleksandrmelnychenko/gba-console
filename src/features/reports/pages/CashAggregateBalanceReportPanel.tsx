import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { previewCashAggregateBalance } from '../api/cashAggregateBalanceApi'
import { cashAggregateBalanceCellText, cashAggregateBalancePeriodError, isCashAggregateBalanceCapabilities,
  type CashAggregateBalanceCapabilities, type CashAggregateBalanceInputs, type CashAggregateBalancePoint,
  type CashAggregateBalanceReport, type CashAggregateBalanceRow, type CashAggregateBalanceTotals } from '../data/cashAggregateBalance'
import { useReportRunState } from '../hooks/useReportRunState'
import { formatDateTime, normalizeReportResult } from '../utils'

export function CashAggregateBalanceReportPanel({ capability, initialPeriod, canGenerate, callerKey, onLoadingChange }: {
  capability: CashAggregateBalanceCapabilities; initialPeriod: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (loading: boolean) => void
}) {
  const { t } = useI18n()
  const [period, setPeriod] = useState(initialPeriod)
  const run = useReportRunState<CashAggregateBalanceReport>(JSON.stringify([callerKey, canGenerate, capability, period]))
  const error = cashAggregateBalancePeriodError(period)
  const executable = isCashAggregateBalanceCapabilities(capability) && capability.Executable
  const canSubmit = canGenerate && executable && !error && !run.isLoading
  const report = run.lastRun
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)
  async function generate(openFiles: boolean) {
    if (!canSubmit) return
    const updateAttempt = run.begin(); onLoadingChange?.(true)
    try {
      const response = await previewCashAggregateBalance(capability, period)
      const result = normalizeReportResult(response)
      updateAttempt({ result, lastRun: response,
        downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (failure) {
      updateAttempt({ error: failure instanceof ApiError || failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт.' })
    } finally { updateAttempt({ isLoading: false }); onLoadingChange?.(false) }
  }
  return <Stack gap="md">
    <Text size="sm">{t('Оберіть дату залишків коштів. Попередня дата — на три календарні місяці раніше.')}</Text>
    <Text size="sm" c="dimmed">{t('Залишки показуються за нашими рахунками в підтвердженій управлінській валюті. Дані для двох дат можуть бути оновлені в різний час.')}</Text>
    <TextInput type="date" label={t('Період')} value={period} disabled={!canGenerate || run.isLoading}
      onChange={event => setPeriod(event.currentTarget.value)} />
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
    {report ? <section aria-label={t('Результат сукупного залишку коштів')}>
      <Text size="sm">{t('Поточна дата')}: {report.CurrentPeriod.Day} · {t('Попередня дата')}: {report.PreviousPeriod.Day}</Text>
      <Table.ScrollContainer minWidth={800}><Table>
        <Table.Thead><Table.Tr><Table.Th>{t('БанковскийСчетКасса')}</Table.Th>{report.Columns.map(column =>
          <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
        <Table.Tbody>{report.Rows.map(row => <CashBalanceRow key={`${row.Account.Id}:${row.Account.NetUid}`}
          label={`${row.Account.Name || t('Рахунок')} [${row.Account.Id}]`} row={row} report={report} />)}</Table.Tbody>
        <Table.Tfoot><CashBalanceRow label={t('Разом')} row={report.Totals} report={report} /></Table.Tfoot>
      </Table></Table.ScrollContainer>
      {!report.Rows.length ? <Text size="sm">{t('Рахунків за поточними даними немає.')}</Text> : null}
      {report.Rows.some(row => row.Cells.some(cell => !cell.Available)) || report.Totals.Cells.some(cell => !cell.Available)
        ? <Alert color="yellow">{t('Порожні клітинки позначають недоступні значення. Невідомі залишки не прирівнюються до нуля; підсумок залишається недоступним, якщо для нього бракує даних.')}</Alert> : null}
      <Stack gap="xs">{report.Rows.map(row => <details key={`${row.Account.Id}:${row.Account.NetUid}`}>
        <summary>{t('Стан даних')}: {row.Account.Name || t('Рахунок')} [{row.Account.Id}]</summary>
        <CashBalanceAvailability inputs={row.Inputs} />
        <CalculationAvailability code={row.CalculationCode} />
        {row.Legs.map(leg => <Group key={leg.Native.CurrencyRegisterId} align="flex-start" grow>
          <CashPointClock label={t('Поточна дата')} day={report.CurrentPeriod.Day} point={leg.Current} />
          <CashPointClock label={t('Попередня дата')} day={report.PreviousPeriod.Day} point={leg.Previous} />
        </Group>)}
      </details>)}</Stack>
      <CashBalanceAvailability inputs={report.Totals.Inputs} />
      <CalculationAvailability code={report.Totals.CalculationCode} />
    </section> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={`${capability.Title}: ${report?.Period ?? period}`} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function CashBalanceRow({ label, row, report }: { label: string; row: CashAggregateBalanceRow | CashAggregateBalanceTotals; report: CashAggregateBalanceReport }) {
  const { t } = useI18n()
  return <Table.Tr><Table.Th scope="row">{label}</Table.Th>{row.Cells.map((cell, index) => <Table.Td key={cell.Key}
    title={cell.Available ? undefined : t('Недоступні дані')}>{cashAggregateBalanceCellText(cell.Value, report.Columns[index].DecimalPlaces)}</Table.Td>)}</Table.Tr>
}
const unavailableMessages: Record<string, string> = {
  mixed_management_currency: 'Залишки мають різні управлінські валюти.',
  management_currency_unconfirmed: 'Управлінська валюта не визначена.',
  source_grain_ambiguous: 'Залишок неоднозначно віднесений до рахунків.',
}
function CashBalanceAvailability({ inputs }: { inputs: CashAggregateBalanceInputs }) {
  const { t } = useI18n()
  return <Stack gap={4}>{(['Current', 'Previous'] as const).map(key => <Text key={key} size="sm">
    {t(key === 'Current' ? 'Поточна дата' : 'Попередня дата')}: {inputs[key].Available
      ? inputs[key].Currency ? `${inputs[key].Currency.Name} (${inputs[key].Currency.Code})` : t('Рахунків немає')
      : t(unavailableMessages[inputs[key].Code] ?? 'Даних на цю дату недостатньо.')}
  </Text>)}</Stack>
}
function CashPointClock({ label, day, point }: { label: string; day: string; point: CashAggregateBalancePoint }) {
  const { t } = useI18n()
  return <Stack gap={2}><Text size="sm">{label}: {day}</Text>
    {point.CaptureStartedAtUtc && point.CaptureCompletedAtUtc ? <Text size="xs" c="dimmed">
      {t('Час оновлення')}: {formatDateTime(point.CaptureStartedAtUtc)} — {formatDateTime(point.CaptureCompletedAtUtc)}
    </Text> : <Text size="xs" c="dimmed">{t('Даних на цю дату недостатньо.')}</Text>}
  </Stack>
}
function CalculationAvailability({ code }: { code: string }) {
  const { t } = useI18n()
  if (code === 'management_currency_changed') return <Text size="sm">{t('Валюта залишку змінилася між датами. Порівняння недоступне.')}</Text>
  if (code === 'percentage_range_unavailable') return <Text size="sm">{t('Не вдалося розрахувати відсоткову зміну. Залишки й різниця доступні.')}</Text>
  return null
}
