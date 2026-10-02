import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { ManagementReturnsCapabilities, ManagementReturnsReport, ManagementReturnsWindows } from '../data/managementReturns'
import { useManagementReturnsReport } from '../hooks/useManagementReturnsReport'
import { ServerReportCellsTable } from './ServerReportCellsTable'

export function ManagementReturnsReportPanel(props: { capability: ManagementReturnsCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void }) {
  const { t } = useI18n()
  const { windows, setWindows, periodError, executable, canSubmit, run, hasFiles, generate } = useManagementReturnsReport(props)
  return <Stack gap="md">
    <Text size="sm">{t('Повернення проданих товарів за двома явними періодами з даних нашої системи. Суми в управлінській валюті; без валютного перерахунку.')}</Text>
    <ManagementReturnsPeriodInputs windows={windows} disabled={!props.canGenerate || run.isLoading} onChange={setWindows} />
    {!props.canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {periodError ? <Alert color="yellow">{t(periodError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {run.lastRun ? <ManagementReturnsResult report={run.lastRun} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened} title={props.capability.ReportName}
      onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function ManagementReturnsPeriodInputs({ windows, disabled, onChange }: { windows: ManagementReturnsWindows; disabled: boolean; onChange: (value: ManagementReturnsWindows) => void }) {
  const { t } = useI18n()
  return <Stack gap="xs">
    <Text size="xs" c="dimmed">{t('Локальні календарні межі: початок включно, кінцева межа не включається.')}</Text>
    {(['CurrentPeriod', 'PreviousPeriod'] as const).map(name => <Group grow key={name}>
      <TextInput type="datetime-local" step="0.001" label={t(name === 'CurrentPeriod' ? 'Поточний період: початок' : 'Попередній період: початок')}
        value={windows[name].From} disabled={disabled} onChange={event => onChange({ ...windows, [name]: { ...windows[name], From: event.currentTarget.value } })} />
      <TextInput type="datetime-local" step="0.001" label={t(name === 'CurrentPeriod' ? 'Поточний період: виключна кінцева межа' : 'Попередній період: виключна кінцева межа')}
        value={windows[name].ThroughExclusive} disabled={disabled} onChange={event => onChange({ ...windows, [name]: { ...windows[name], ThroughExclusive: event.currentTarget.value } })} />
    </Group>)}
  </Stack>
}
function ManagementReturnsResult({ report }: { report: ManagementReturnsReport }) {
  const { t } = useI18n()
  const unavailable = report.Totals.some(cell => !cell.Available) || report.Rows.some(row => row.Cells.some(cell => !cell.Available))
  return <section aria-label={t('Результат управлінських повернень')}>
    <Text size="sm">{report.ManagementCurrency}</Text>
    {report.Complete && !report.HasRows ? <Alert color="blue">{t('У вибраних періодах немає повернень.')}</Alert> : null}
    <section aria-label={t('Підсумок')}><ServerReportCellsTable columns={report.Columns} cells={report.Totals} /></section>
    {report.Rows.length ? <ManagementReturnsGroups report={report} /> : null}
    {!report.Complete ? <Alert color="yellow">{t('Звіт неповний: синк продажів або власників договорів ще не підтверджений для одного з періодів.')}</Alert> : null}
    {!report.Inputs.Current.Available ? <Text size="sm">{t('Поточний період: дані ще не підтверджені.')}</Text> : null}
    {!report.Inputs.Previous.Available ? <Text size="sm">{t('Попередній період: дані ще не підтверджені.')}</Text> : null}
    {!report.CounterpartyNamesComplete ? <Alert color="yellow">{t('Назви деяких контрагентів недоступні; розраховані показники збережені.')}</Alert> : null}
    {report.HasRows && unavailable ? <Alert color="yellow">{t('Не всі показники вдалося розрахувати.')}</Alert> : null}
  </section>
}
function ManagementReturnsGroups({ report }: { report: ManagementReturnsReport }) {
  const { t } = useI18n()
  return <Stack gap="sm" aria-label={t('Контрагенти повернень')}>{report.Rows.map(row => <section key={row.Key}>
    <Text fw={600}>{row.SourceNull ? t('Немає значення') : row.NameAvailable ? row.Caption : t('Назва недоступна')}</Text>
    <ServerReportCellsTable columns={report.Columns} cells={row.Cells} />
  </section>)}</Stack>
}
