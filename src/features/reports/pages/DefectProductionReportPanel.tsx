import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { DefectProductionCapabilities, DefectProductionInput, DefectProductionReport } from '../data/defectProduction'
import { useDefectProductionReport } from '../hooks/useDefectProductionReport'
import { ServerReportCellsTable } from './ServerReportCellsTable'

export function DefectProductionReportPanel(props: { capability: DefectProductionCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void }) {
  const { t } = useI18n()
  const { month, setMonth, monthError, executable, canSubmit, run, hasFiles, generate } = useDefectProductionReport(props)
  return <Stack gap="md">
    <DefectProductionMonthInput month={month} disabled={!props.canGenerate || run.isLoading} onChange={setMonth} />
    {!props.canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {monthError ? <Alert color="yellow">{t(monthError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {run.lastRun ? <DefectProductionResult report={run.lastRun} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened} title={`${props.capability.ReportName}: ${month}`}
      onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function DefectProductionMonthInput({ month, disabled, onChange }: { month: string; disabled: boolean; onChange: (value: string) => void }) {
  const { t } = useI18n()
  return <>
    <Text size="sm">{t('Поточне й попереднє значення — відношення планової вартості браку до всієї продукції.')}</Text>
    <Text size="xs" c="dimmed">{t('Порівняння календарних місяців у GBA. Інші періоди та збережені налаштування 1С ще не підтримуються.')}</Text>
    <TextInput type="month" label={t('Місяць')} value={month} disabled={disabled} onChange={event => onChange(event.currentTarget.value)} />
  </>
}
function DefectProductionResult({ report }: { report: DefectProductionReport }) {
  const { t } = useI18n()
  return <section aria-label={t('Результат звіту браку')}>
    <Text size="sm">{t('Поточний період')}: {report.CurrentPeriod.From.slice(0, 10)} — {report.CurrentPeriod.ThroughExclusive.slice(0, 10)}; {t('Попередній період')}: {report.PreviousPeriod.From.slice(0, 10)} — {report.PreviousPeriod.ThroughExclusive.slice(0, 10)}</Text>
    {report.Complete && !report.HasRows ? <Alert color="blue">{t('У вибраних місяцях немає виробничих даних.')}</Alert> : null}
    <ServerReportCellsTable columns={report.Columns} cells={report.Cells} />
    <DefectProductionPeriodStatus input={report.Inputs.Current} current />
    <DefectProductionPeriodStatus input={report.Inputs.Previous} current={false} />
    <DefectProductionWarnings report={report} />
  </section>
}
function DefectProductionPeriodStatus({ input, current }: { input: DefectProductionInput; current: boolean }) {
  const { t } = useI18n()
  if (!input.Available) return <Text size="sm">{t(current ? 'Поточний період: дані ще не підтверджені.' : 'Попередній період: дані ще не підтверджені.')}</Text>
  if (input.IncludedRows === 0) return <Text size="sm">{t(current ? 'Поточний період: підтверджено відсутність даних.' : 'Попередній період: підтверджено відсутність даних.')}</Text>
  return null
}
function DefectProductionWarnings({ report }: { report: DefectProductionReport }) {
  const { t } = useI18n()
  return <>
    {!report.Complete ? <Alert color="yellow">{t('Звіт неповний: виробничі дані або визначення якості для одного з місяців ще не підтверджені.')}</Alert> : null}
    {report.Cells.some(cell => !cell.Available) ? <Alert color="yellow">{t('Не всі показники вдалося розрахувати.')}</Alert> : null}
  </>
}
