import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { InventoryTurnoverCapabilities, InventoryTurnoverInput, InventoryTurnoverReport } from '../data/inventoryTurnover'
import { useInventoryTurnoverReport } from '../hooks/useInventoryTurnoverReport'
import { ServerReportCellsTable } from './ServerReportCellsTable'

export function InventoryTurnoverReportPanel(props: { capability: InventoryTurnoverCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void }) {
  const { t } = useI18n()
  const { month, setMonth, monthError, executable, canSubmit, run, hasFiles, generate } = useInventoryTurnoverReport(props)
  return <Stack gap="md">
    <Text size="sm">{t('Порівняння поточного й попереднього календарних місяців.')}</Text>
    <TextInput type="month" label={t('Місяць')} value={month} disabled={!props.canGenerate || run.isLoading}
      onChange={event => setMonth(event.currentTarget.value)} />
    {!props.canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {monthError ? <Alert color="yellow">{t(monthError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {run.lastRun ? <InventoryTurnoverResult report={run.lastRun} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened} title={`${props.capability.ReportName}: ${month}`}
      onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function InventoryTurnoverResult({ report }: { report: InventoryTurnoverReport }) {
  const { t } = useI18n()
  return <section aria-label={t('Результат оборачуваності запасів')}>
    <Text size="sm">{t('Поточний період')}: {report.CurrentPeriod.From} — {report.CurrentPeriod.ThroughExclusive}; {t('Попередній період')}: {report.PreviousPeriod.From} — {report.PreviousPeriod.ThroughExclusive}</Text>
    {report.AvailabilityMessage ? <Alert color={!report.Complete || report.Cells.some(cell => !cell.Available) ? 'yellow' : 'blue'}>{t(report.AvailabilityMessage)}</Alert> : null}
    <ServerReportCellsTable columns={report.Columns} cells={report.Cells} />
    <InventoryTurnoverPeriodStatus input={report.Inputs.Current} current />
    <InventoryTurnoverPeriodStatus input={report.Inputs.Previous} current={false} />
    <Text size="xs" c="dimmed">{t('Вихідні суми')}: {report.ResourceUnits.map(unit => `${unit.SourceCaption} ${unit.SourceUnitAnnotation}`).join('; ')}.</Text>
  </section>
}
function InventoryTurnoverPeriodStatus({ input, current }: { input: InventoryTurnoverInput; current: boolean }) {
  const { t } = useI18n()
  if (!input.Complete) return <Text size="sm">{t(current ? 'Поточний період: дані синку ще не готові.' : 'Попередній період: дані синку ще не готові.')}</Text>
  if (input.IncludedRows === 0) return <Text size="sm">{t(current ? 'Поточний період: підтверджено відсутність даних.' : 'Попередній період: підтверджено відсутність даних.')}</Text>
  if (!input.ScalarDefined) return <Text size="sm">{t(current ? 'Поточний період: показник не визначений.' : 'Попередній період: показник не визначений.')}</Text>
  return null
}
