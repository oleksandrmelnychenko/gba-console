import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { PlannedCashCapabilities, PlannedCashCell, PlannedCashFilters, PlannedCashReport } from '../data/plannedCash'
import { usePlannedCashReport } from '../hooks/usePlannedCashReport'

export function PlannedCashReportPanel(props: { capability: PlannedCashCapabilities; initialFilters: PlannedCashFilters; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (value: boolean) => void }) {
  const { t } = useI18n()
  const { filters, change, filterError, executable, canSubmit, run, hasFiles, generate } = usePlannedCashReport(props)
  const disabled = !props.canGenerate || run.isLoading, scenario = props.capability.RequiresObservedScenario
  return <Stack gap="md">
    <Text size="sm">{t('Звіт із поточних даних GBA. Кінцева дата періоду не входить до нього.')}</Text>
    <Group grow>
      <TextInput type="date" label={t('Період від')} value={filters.From} disabled={disabled} onChange={event => change('From', event.currentTarget.value)} />
      <TextInput type="date" label={t('Період до (не включно)')} value={filters.ThroughExclusive} disabled={disabled} onChange={event => change('ThroughExclusive', event.currentTarget.value)} />
    </Group>
    {scenario ? <Group grow>
      <TextInput type="date" label={t('Попередній період від')} value={filters.PreviousFrom} disabled={disabled} onChange={event => change('PreviousFrom', event.currentTarget.value)} />
      <TextInput type="date" label={t('Попередній період до (не включно)')} value={filters.PreviousThroughExclusive} disabled={disabled} onChange={event => change('PreviousThroughExclusive', event.currentTarget.value)} />
    </Group> : <TextInput type="date" label={t('Дата планового залишку')} value={filters.PlanEndpoint} disabled={disabled}
      description={t('Оберіть дату, на яку потрібно взяти плановий залишок.')} onChange={event => change('PlanEndpoint', event.currentTarget.value)} />}
    {!props.canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {filterError ? <Alert color="yellow">{t(filterError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Text size="sm" c="dimmed">{t('Інші відбори й збережені варіанти цієї форми ще недоступні.')}</Text>
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {run.lastRun ? <PlannedCashResult report={run.lastRun} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened} title={props.capability.ReportName}
      onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function PlannedCashCells({ cells }: { cells: PlannedCashCell[] }) {
  const { t } = useI18n()
  return cells.map(cell => <Table.Td key={cell.Key} className="app-money"
    title={!cell.Available ? t('Недоступні дані') : cell.Value === null ? t('У періоді немає даних') : undefined}>{cell.FormattedValue ?? ''}</Table.Td>)
}
function PlannedCashResult({ report }: { report: PlannedCashReport }) {
  const { t } = useI18n()
  return <section aria-label={t('Результат планування коштів')}>
    <Text size="sm">{t('Період')}: {report.CurrentPeriod.From.slice(0, 10)} — {report.CurrentPeriod.ThroughExclusive.slice(0, 10)}</Text>
    {report.PlanEndpoint ? <Text size="sm">{t('Дата планового залишку')}: {report.PlanEndpoint.slice(0, 10)}</Text> : null}
    {report.AvailabilityMessage ? <Alert color={report.Complete && !report.HasRows ? 'blue' : 'yellow'}>{t(report.AvailabilityMessage)}</Alert> : null}
    {report.GroupLabelsAvailabilityMessage ? <Alert color="yellow">{t(report.GroupLabelsAvailabilityMessage)}</Alert> : null}
    <Table.ScrollContainer minWidth={800}><Table>
      <Table.Thead><Table.Tr><Table.Th>{t(report.Grouping === 'Контрагент' ? 'Контрагент' : 'Стаття руху коштів')}</Table.Th>
        {report.Columns.map(column => <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{report.Rows.map(row => <Table.Tr key={row.Key}><Table.Td>{row.NameAvailable ? row.Name : t('Назва групи ще недоступна')}</Table.Td><PlannedCashCells cells={row.Cells} /></Table.Tr>)}
        <Table.Tr><Table.Th scope="row">{t('Разом')}</Table.Th><PlannedCashCells cells={report.Totals} /></Table.Tr></Table.Tbody>
    </Table></Table.ScrollContainer>
    <Text size="xs" c="dimmed">{t('Управлінські суми без перерахунку валют. Суми у валюті рахунку та взаєморозрахунків не підміняють ці показники.')}</Text>
  </section>
}
