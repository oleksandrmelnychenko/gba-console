import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { ManagementBalanceCapabilities, ManagementBalanceKind, ManagementBalanceReport } from '../data/managementBalance'
import { useManagementBalanceReport } from '../hooks/useManagementBalanceReport'
import { ServerReportCellsTable } from './ServerReportCellsTable'

export function ManagementBalanceReportPanel(props: { capability: ManagementBalanceCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void }) {
  const { t } = useI18n()
  const { kind, period, setPeriod, periodError, executable, canSubmit, run, hasFiles, generate } = useManagementBalanceReport(props)
  return <Stack gap="md">
    <ManagementBalancePeriodInput kind={kind} period={period} disabled={!props.canGenerate || run.isLoading} onChange={setPeriod} />
    {!props.canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {periodError ? <Alert color="yellow">{t(periodError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {run.lastRun ? <ManagementBalanceResult report={run.lastRun} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened} title={`${props.capability.ReportName}: ${period}`}
      onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function ManagementBalanceResult({ report }: { report: ManagementBalanceReport }) {
  const { t } = useI18n()
  return <section aria-label={t('Результат управлінської заборгованості')}>
    <Text size="sm">{t('Поточна межа')}: {report.CurrentThroughExclusive}; {t('Попередня межа')}: {report.PreviousThroughExclusive}</Text>
    {report.Complete && !report.HasRows ? <Alert color="blue">{t('На вибрані межі немає заборгованості цього виду.')}</Alert> : null}
    <section aria-label={t('Підсумок')}><ServerReportCellsTable columns={report.Columns} cells={report.Totals} /></section>
    {report.Rows.length ? <ManagementBalanceGroups report={report} /> : null}
    <ManagementBalanceWarnings report={report} />
  </section>
}
function ManagementBalanceGroups({ report }: { report: ManagementBalanceReport }) {
  const { t } = useI18n()
  return <Stack gap="sm" aria-label={t('Контрагенти заборгованості')}>{report.Rows.map(row => <section key={row.Key}>
    <Text fw={600}>{row.NameAvailable ? row.Caption : t('Назва недоступна')}</Text>
    <ServerReportCellsTable columns={report.Columns} cells={row.Cells} />
  </section>)}</Stack>
}

function ManagementBalancePeriodInput({ kind, period, disabled, onChange }: {
  kind: ManagementBalanceKind; period: string; disabled: boolean; onChange: (value: string) => void
}) {
  const { t } = useI18n(), quarterly = kind === 'quarterlyManagementPayables'
  return <>
    <Text size="sm">{t(quarterly
      ? 'Управлінська кредиторська заборгованість на початок і кінець вибраного кварталу з даних нашої системи.'
      : 'Дебіторська заборгованість на початок і кінець вибраного місяця з даних нашої системи.')}</Text>
    <Text size="sm">{t('Групування за контрагентом. Управлінський ресурс (Упр), без валютного перерахунку.')}</Text>
    <TextInput type={quarterly ? 'text' : 'month'} label={t(quarterly ? 'Квартал' : 'Місяць')}
      placeholder={quarterly ? '2026-Q3' : undefined} description={quarterly ? t('Формат: РРРР-Q1, Q2, Q3 або Q4') : undefined}
      value={period} disabled={disabled} onChange={event => onChange(event.currentTarget.value)} />
  </>
}
function ManagementBalanceWarnings({ report }: { report: ManagementBalanceReport }) {
  const { t } = useI18n()
  const unavailable = report.Totals.some(cell => !cell.Available) || report.Rows.some(row => row.Cells.some(cell => !cell.Available))
  return <>
    {!report.Complete ? <Alert color="yellow">{t('Звіт неповний: залишки, рухи або суми для потрібних періодів ще не підтверджені.')}</Alert> : null}
    {!report.Inputs.Current.Available ? <Text size="sm">{t('Поточна межа: дані ще не підтверджені.')}</Text> : null}
    {!report.Inputs.Previous.Available ? <Text size="sm">{t('Попередня межа: дані ще не підтверджені.')}</Text> : null}
    {!report.CounterpartyNamesComplete ? <Alert color="yellow">{t('Назви деяких контрагентів недоступні; розраховані показники збережені.')}</Alert> : null}
    {report.HasRows && unavailable ? <Alert color="yellow">{t('Не всі показники вдалося розрахувати.')}</Alert> : null}
  </>
}
