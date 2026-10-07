import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { CurrentLiquidityCapabilities, CurrentLiquidityEndpoints, CurrentLiquidityInput, CurrentLiquidityReport } from '../data/currentLiquidity'
import { useCurrentLiquidityReport } from '../hooks/useCurrentLiquidityReport'
import { ServerReportCellsTable } from './ServerReportCellsTable'

export function CurrentLiquidityReportPanel(props: { capability: CurrentLiquidityCapabilities; initialEndpoints: CurrentLiquidityEndpoints; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void }) {
  const { t } = useI18n()
  const { current, setCurrent, previous, setPrevious, endpointError, executable, canSubmit, run, hasFiles, generate } = useCurrentLiquidityReport(props)
  return <Stack gap="md">
    <Text size="sm">{t('Порівняння залишків на дві обрані дати. Оберіть перший день місяця; попередня дата має бути раніше поточної.')}</Text>
    <Group grow>
      <TextInput type="date" label={t('Поточна дата')} value={current} disabled={!props.canGenerate || run.isLoading}
        onChange={event => setCurrent(event.currentTarget.value)} />
      <TextInput type="date" label={t('Попередня дата')} value={previous} disabled={!props.canGenerate || run.isLoading}
        onChange={event => setPrevious(event.currentTarget.value)} />
    </Group>
    {!props.canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {endpointError ? <Alert color="yellow">{t(endpointError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {run.lastRun ? <CurrentLiquidityResult report={run.lastRun} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened} title={`${props.capability.ReportName}: ${previous} — ${current}`}
      onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function CurrentLiquidityResult({ report }: { report: CurrentLiquidityReport }) {
  const { t } = useI18n()
  return <section aria-label={t('Результат поточної ліквідності')}>
    <Text size="sm">{t('Поточна дата')}: {report.CurrentEndpoint}; {t('Попередня дата')}: {report.PreviousEndpoint}</Text>
    {report.AvailabilityMessage ? <Alert color={!report.Complete || report.Cells.some(cell => !cell.Available) ? 'yellow' : 'blue'}>{t(report.AvailabilityMessage)}</Alert> : null}
    <ServerReportCellsTable columns={report.Columns} cells={report.Cells} />
    <CurrentLiquidityEndpointStatus input={report.Inputs.Current} current />
    <CurrentLiquidityEndpointStatus input={report.Inputs.Previous} current={false} />
    <Text size="xs" c="dimmed">{t('Звіт використовує управлінські залишки та роздрібні суми у гривнях без перерахунку валют.')}</Text>
  </section>
}
function CurrentLiquidityEndpointStatus({ input, current }: { input: CurrentLiquidityInput; current: boolean }) {
  const { t } = useI18n()
  if (!input.CoverageComplete) return <Text size="sm">{t(current ? 'Поточна дата: дані синку ще не готові.' : 'Попередня дата: дані синку ще не готові.')}</Text>
  if (!input.Available) return <Text size="sm">{t(current ? 'Поточна дата: частина даних ще не визначена.' : 'Попередня дата: частина даних ще не визначена.')}</Text>
  if (input.IncludedUnionRows === 0) return <Text size="sm">{t(current ? 'Поточна дата: підтверджено відсутність даних.' : 'Попередня дата: підтверджено відсутність даних.')}</Text>
  return null
}
