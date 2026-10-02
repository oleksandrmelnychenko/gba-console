import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { ManagementOrdersCapabilities, ManagementOrdersReport } from '../data/managementOrders'
import { useManagementOrdersReport } from '../hooks/useManagementOrdersReport'
import { ServerReportCellsTable } from './ServerReportCellsTable'

export function ManagementOrdersReportPanel(props: { capability: ManagementOrdersCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void }) {
  const { t } = useI18n()
  const { month, setMonth, monthError, executable, canSubmit, run, hasFiles, generate } = useManagementOrdersReport(props)
  return <Stack gap="md">
    <ManagementOrdersMonthInput month={month} disabled={!props.canGenerate || run.isLoading} onChange={setMonth} />
    {!props.canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {monthError ? <Alert color="yellow">{t(monthError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {run.lastRun ? <ManagementOrdersResult report={run.lastRun} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened} title={`${props.capability.ReportName}: ${month}`}
      onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function ManagementOrdersMonthInput({ month, disabled, onChange }: { month: string; disabled: boolean; onChange: (value: string) => void }) {
  const { t } = useI18n()
  return <>
    <Text size="sm">{t('Сума оформлених замовлень за вибраний і попередній місяць з даних нашої системи.')}</Text>
    <Text size="sm">{t('Групування за контрагентом. Управлінський ресурс (Упр), без валютного перерахунку.')}</Text>
    <Text size="xs" c="dimmed">{t('Місячна форма за замовчуванням. Додаткові відбори та групування збережених варіантів поки недоступні.')}</Text>
    <TextInput type="month" label={t('Місяць')} value={month} disabled={disabled} onChange={event => onChange(event.currentTarget.value)} />
  </>
}
function ManagementOrdersResult({ report }: { report: ManagementOrdersReport }) {
  const { t } = useI18n()
  return <section aria-label={t('Результат оригінальних замовлень')}>
    <Text size="sm">{t('Поточний період')}: {report.CurrentPeriod.From.slice(0, 10)} — {report.CurrentPeriod.ThroughExclusive.slice(0, 10)}; {t('Попередній період')}: {report.PreviousPeriod.From.slice(0, 10)} — {report.PreviousPeriod.ThroughExclusive.slice(0, 10)}</Text>
    {report.Complete && !report.HasRows ? <Alert color="blue">{t('У вибраних місяцях немає замовлень.')}</Alert> : null}
    <section aria-label={t('Підсумок')}><ServerReportCellsTable columns={report.Columns} cells={report.Totals} /></section>
    {report.Rows.length ? <ManagementOrdersGroups report={report} /> : null}
    <ManagementOrdersWarnings report={report} />
  </section>
}
function ManagementOrdersGroups({ report }: { report: ManagementOrdersReport }) {
  const { t } = useI18n()
  return <Stack gap="sm" aria-label={t('Контрагенти замовлень')}>{report.Rows.map(row => <section key={row.Key}>
    <Text fw={600}>{row.SourceNull ? t('Немає значення') : row.NameAvailable ? row.Caption : t('Назва недоступна')}</Text>
    <ServerReportCellsTable columns={report.Columns} cells={row.Cells} />
  </section>)}</Stack>
}
function ManagementOrdersWarnings({ report }: { report: ManagementOrdersReport }) {
  const { t } = useI18n()
  const unavailable = report.Totals.some(cell => !cell.Available) || report.Rows.some(row => row.Cells.some(cell => !cell.Available))
  return <>
    {!report.Complete ? <Alert color="yellow">{t('Звіт неповний: дані замовлень або суми для одного з місяців ще не підтверджені.')}</Alert> : null}
    {!report.Inputs.Current.Available ? <Text size="sm">{t('Поточний період: дані ще не підтверджені.')}</Text> : null}
    {!report.Inputs.Previous.Available ? <Text size="sm">{t('Попередній період: дані ще не підтверджені.')}</Text> : null}
    {!report.CounterpartyNamesComplete ? <Alert color="yellow">{t('Назви деяких контрагентів недоступні; розраховані показники збережені.')}</Alert> : null}
    {report.HasRows && unavailable ? <Alert color="yellow">{t('Не всі показники вдалося розрахувати.')}</Alert> : null}
  </>
}
