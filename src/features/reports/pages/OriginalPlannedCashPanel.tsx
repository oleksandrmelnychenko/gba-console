import { Alert, Button, Group, MultiSelect, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readOriginalPlannedCash } from '../api/originalPlannedCashApi'
import { plannedDefaultRows, plannedDefinitions, plannedFieldLabels, plannedFields, plannedFilterFields, plannedFilterKey, plannedPeriodError, plannedRequest,
  type OriginalPlannedResult, type PlannedCapability, type PlannedChoice, type PlannedField, type PlannedFilter } from '../data/originalPlannedCash'
import { plannedCsv, plannedExportError, plannedMatrix, plannedPdf, plannedXlsx } from '../data/originalPlannedCashExport'
import { useReportRunState } from '../hooks/useReportRunState'

const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
const dependencies: Record<string, string> = {
  original_planned_cash_opening_publication_unavailable: 'Немає повного початкового залишку для цього періоду.',
  original_planned_cash_month_publication_unavailable: 'Не всі місячні рухи цього періоду повністю синхронізовані.',
  original_planned_cash_document_grouping_unavailable: 'Для обраного групування потрібні повні реквізити документів планування.',
  original_planned_cash_document_filter_unavailable: 'Для обраного відбору потрібні повні реквізити документів планування.',
  original_planned_cash_normal_storage_unavailable: 'Сховище початкових залишків і місячних рухів недоступне.',
}
function PlannedPeriod({ from, through, busy, change }: { from: string; through: string; busy: boolean; change: (field: 'from' | 'through', value: string) => void }) {
  const { t } = useI18n()
  return <Group grow><TextInput type="date" label={t('Початок періоду')} value={from} disabled={busy} onChange={event => change('from', event.currentTarget.value)} />
    <TextInput type="date" label={t('Кінець періоду')} value={through} disabled={busy} onChange={event => change('through', event.currentTarget.value)} /></Group>
}
function PlannedSelections({ rows, filters, choices, busy, group, select }: { rows: PlannedField[]; filters: PlannedFilter[]; choices: PlannedChoice[]; busy: boolean;
  group: (rows: PlannedField[]) => void; select: (field: PlannedField, keys: string[]) => void }) {
  const { t } = useI18n()
  return <>
    <MultiSelect label={t('Групування рядків у вибраному порядку')} data={plannedFields.map(field => ({ value: field, label: t(plannedFieldLabels[field]) }))}
      value={rows} disabled={busy} clearable onChange={values => group(values as PlannedField[])} maxValues={9} />
    {plannedFilterFields.map(field => {
      const options = choices.filter(choice => choice.Field === field).map(choice => ({ value: plannedFilterKey(choice), label: choice.Caption }))
      return <MultiSelect key={field} label={t(plannedFieldLabels[field])} data={options} value={filters.filter(filter => filter.Field === field).map(plannedFilterKey)}
        disabled={busy || (!options.length && !filters.some(filter => filter.Field === field))} clearButtonProps={{ 'aria-label': `${t('Очистити')} ${t(plannedFieldLabels[field])}` }} placeholder={t(options.length ? 'Усі; оберіть потрібні значення' : 'Назви для відбору ще недоступні')}
        searchable clearable limit={50} maxValues={256} onChange={keys => select(field, keys)} />
    })}
  </>
}
function PlannedTable({ report }: { report: OriginalPlannedResult }) {
  const { t } = useI18n(), [page, setPage] = useState(0)
  const matrix = useMemo(() => plannedMatrix(report), [report]), body = matrix.slice(1, report.Totals ? -1 : undefined)
  const current = Math.min(page, Math.max(0, Math.ceil(body.length / 50) - 1)), start = current * 50
  return <Stack gap="xs"><Group><Button size="xs" variant="light" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text size="xs">{body.length ? start + 1 : 0}–{Math.min(start + 50, body.length)} / {body.length}</Text>
    <Button size="xs" variant="light" disabled={start + 50 >= body.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1500}><Table><Table.Thead><Table.Tr>{matrix[0].map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{body.slice(start, start + 50).map(row => <Table.Tr key={row[0]}>{row.map((value, column) => <Table.Td key={matrix[0][column]}>{value}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
      {report.Totals ? <Table.Tfoot><Table.Tr>{matrix.at(-1)?.map((value, column) => <Table.Th key={matrix[0][column]}>{value}</Table.Th>)}</Table.Tr></Table.Tfoot> : null}
    </Table></Table.ScrollContainer>{!body.length ? <Text>{t('У повністю перевіреному періоді рядків немає.')}</Text> : null}</Stack>
}
function PlannedResult({ report, exportError }: { report: OriginalPlannedResult | null; exportError: string | null }) {
  const { t } = useI18n()
  return <>{exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    {report && !report.Available ? <Alert color="yellow">{t(dependencies[report.Code] ?? 'Повних узгоджених даних для цього запиту немає; частковий звіт не формується.')}</Alert> : null}
    {report?.Available ? <><Text size="sm" c="dimmed">{t('Відбір пропонує лише справжні поточні назви з наших довідників. Відсутні назви не замінюються технічними ідентифікаторами; окремі групи збережено.')}</Text>
      {exportError ? <Text>{t('Результат перевищує межу відображення та експорту; звузьте період або групування.')}</Text> : <PlannedTable key={report.ResultSha256} report={report} />}</> : null}
  </>
}
function usePlannedRun({ capability, callerKey, permitted, from, through, rows, filters, key, receiveChoices }: {
  capability: PlannedCapability; callerKey: string | null; permitted: boolean; from: string; through: string; rows: PlannedField[]; filters: PlannedFilter[]; key: string; receiveChoices: (value: PlannedChoice[]) => void
}) {
  const run = useReportRunState<OriginalPlannedResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key), [exporting, setExporting] = useState(false)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const allowed = permitted && !!callerKey && capability.Executable && capability.World === 'fenix', error = plannedPeriodError(from, through), report = run.lastRun
  function invalidate() { latest.current = ''; active.current?.abort(); run.clear() }
  async function generate() {
    if (!allowed || error || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; latest.current = key
    const update = run.begin()
    try {
      const request = plannedRequest(capability, from, through, rows, filters), result = await readOriginalPlannedCash(request, controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: result }); if (result.Available) receiveChoices(result.Choices)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати плановий звіт.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    if (!allowed || !report?.Available || exporting) return
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([plannedCsv(report)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await plannedXlsx(report) : await plannedPdf(report)
      if (latest.current === key) download(blob, `${report.Variant}-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, report, exporting, error, allowed, invalidate, generate, exportFile, exportError: report?.Available ? plannedExportError(report) : null }
}
function PlannedActions({ allowed, loading, exporting, error, available, exportError, generate, exportFile }: {
  allowed: boolean; loading: boolean; exporting: boolean; error: string | null; available: boolean; exportError: string | null;
  generate: () => Promise<void>; exportFile: (format: typeof formats[number]) => Promise<void>
}) {
  const { t } = useI18n()
  return <Group><Button disabled={!allowed || loading || exporting || !!error} loading={loading} onClick={() => { void generate() }}>{t('Сформувати')}</Button>
    {formats.map(format => <Button key={format} variant="light" disabled={!allowed || !available || exporting || !!exportError} onClick={() => { void exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
}
export function OriginalPlannedCashPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: PlannedCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough), [rows, setRows] = useState<PlannedField[]>([...plannedDefaultRows])
  const [selection, setSelection] = useState<{ scope: string; filters: PlannedFilter[] }>({ scope: '', filters: [] })
  const [choiceState, setChoiceState] = useState<{ scope: string; choices: PlannedChoice[]; selectedCaptions: PlannedChoice[] } | null>(null)
  const scope = JSON.stringify([callerKey, canGenerate, capability, from, through]), filters = selection.scope === scope ? selection.filters : []
  const currentChoices = choiceState?.scope === scope ? choiceState.choices : [], selectedKeys = new Set(filters.map(plannedFilterKey))
  const choices = [...currentChoices, ...(choiceState?.scope === scope ? choiceState.selectedCaptions.filter(choice => selectedKeys.has(plannedFilterKey(choice))) : [])]
  const key = JSON.stringify([scope, rows, filters])
  const delivery = usePlannedRun({ capability, callerKey, permitted: canGenerate, from, through, rows, filters, key,
    receiveChoices: value => setChoiceState(previous => {
      const freshKeys = new Set(value.map(plannedFilterKey)), appliedKeys = new Set(filters.map(plannedFilterKey))
      const prior = previous?.scope === scope ? [...previous.choices, ...previous.selectedCaptions] : []
      return { scope, choices: value, selectedCaptions: prior.filter(choice => appliedKeys.has(plannedFilterKey(choice)) && !freshKeys.has(plannedFilterKey(choice))) }
    }) })
  const busy = delivery.run.isLoading || delivery.exporting
  function select(field: PlannedField, keys: string[]) {
    const selected = new Set(keys), current = choices.filter(choice => choice.Field === field && selected.has(plannedFilterKey(choice)))
    delivery.invalidate(); setSelection({ scope, filters: [...filters.filter(filter => filter.Field !== field), ...current.map(choice => ({ Field: choice.Field, Type: choice.Type, Table: choice.Table, Reference: choice.Reference }))] })
  }
  return <Stack gap="md"><Text>{t(plannedDefinitions[capability.Variant].title)}</Text>
    <PlannedPeriod from={from} through={through} busy={busy} change={(field, value) => { delivery.invalidate(); if (field === 'from') setFrom(value); else setThrough(value) }} />
    <PlannedSelections rows={rows} filters={filters} choices={choices} busy={busy} group={value => { delivery.invalidate(); setRows(value) }} select={select} />
    <Text size="sm" c="dimmed">{t('Початковий залишок, надходження, витрати та кінцевий залишок для взаєморозрахунків, управлінської суми й суми коштів. Період включає 00:00:00…23:59:59, без валютного перерахунку. Спостережені нульові рядки збережено; відповідність усім правилам 1С ще не підтверджена.')}</Text>
    {delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}{delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <PlannedActions allowed={delivery.allowed} loading={delivery.run.isLoading} exporting={delivery.exporting} error={delivery.error} available={!!delivery.report?.Available}
      exportError={delivery.exportError} generate={delivery.generate} exportFile={delivery.exportFile} />
    <PlannedResult report={delivery.report} exportError={delivery.exportError} />
  </Stack>
}
