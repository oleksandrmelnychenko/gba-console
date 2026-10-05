import { Alert, Button, MultiSelect, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readPlannedFlow, readPlannedFlowChoices } from '../api/originalPlannedCashFlowApi'
import { emptyPlannedFlowSelection, plannedFlowDefaults, plannedFlowFieldLabels, plannedFlowFields, plannedFlowLabels, plannedFlowMeasures, plannedFlowPeriodError, plannedFlowRequest, plannedFlowSelectedStillNamed,
  type PlannedFlowCapability, type PlannedFlowChoices, type PlannedFlowField, type PlannedFlowMeasure, type PlannedFlowNamedChoice, type PlannedFlowResult, type PlannedFlowSelection } from '../data/originalPlannedCashFlow'
import type { OriginalDefaultSheet } from '../data/originalDefaultReportExport'
import { useOriginalDefaultPreview } from '../hooks/useOriginalDefaultPreview'
import { OriginalPeriodDateInputs } from './WarehousePeriodControls'
import { OriginalDefaultReportOutput } from './OriginalDefaultReportOutput'

const note = 'Збережені суми у валюті та управлінські суми без перерахунку. Надходження і витрати залишаються знаковими; відповідність усім правилам 1С ще не підтверджена.'
const dependencies: Record<string, string> = {
  planned_cash_flow_branch11_publication_unavailable: 'Не всі рухи плану коштів за цей період повністю синхронізовані.',
  planned_cash_flow_planning_header_publication_unavailable: 'Для звіту ще немає повних реквізитів документів планування.',
  planned_cash_flow_planning_header_parents_changed: 'Дані документів планування змінилися; потрібне їх узгоджене оновлення.',
  planned_cash_flow_department_unobserved: 'Не для всіх документів планування відомий підрозділ.',
  planned_cash_flow_empty_planning_document_unresolved: 'Частина рухів не має підтверджених реквізитів документа планування.',
}
function sheet(result: PlannedFlowResult): OriginalDefaultSheet {
  return { title: 'Плани руху коштів', from: result.From, through: result.Through, labelColumns: 1, note,
    headers: ['Стаття руху коштів', ...result.Measures.map(measure => plannedFlowLabels[measure])],
    lines: result.Rows.map(row => ({ key: row.ArticleReference, cells: [row.Caption ?? 'Назва недоступна', ...result.Measures.map(measure => row.Values[measure])] })),
    total: result.Totals ? ['Разом', ...result.Measures.map(measure => result.Totals![measure])] : null }
}
function PlannedFlowResultView({ result }: { result: PlannedFlowResult | null }) {
  const { t } = useI18n(), output = useMemo(() => result?.Available ? sheet(result) : null, [result])
  if (!result) return null
  if (!output) return <Alert color="yellow">{t(dependencies[result.Code] ?? 'Повних узгоджених даних для цього запиту ще немає; частковий звіт не формується.')}</Alert>
  return <>{result.Rows.some(row => row.Caption === null) ? <Text size="sm">{t('Частина назв статей недоступна. Їхні суми збережено окремими рядками.')}</Text> : null}
    <OriginalDefaultReportOutput key={result.ResultSha256} sheet={output} filename="planned-cash-flow" /></>
}
type PlanningScope = { capability: PlannedFlowCapability; callerKey: string | null; canGenerate: boolean; from: string; through: string; measures: PlannedFlowMeasure[] }
type PlanningCaptionCache = Partial<Record<PlannedFlowField, PlannedFlowNamedChoice[]>>
function retainedCaptions(previous: { scope: PlanningScope; result: PlannedFlowChoices; captions: PlanningCaptionCache } | null, scope: PlanningScope, selection: PlannedFlowSelection): PlanningCaptionCache {
  return Object.fromEntries(plannedFlowFields.map(field => {
    if (!previous || previous.scope !== scope) return [field, []]
    const prior = new Map([...(previous.captions[field] ?? []), ...(previous.result.Fields.find(item => item.Field === field)?.Choices ?? [])].map(choice => [choice.Value, choice]))
    const selected = new Set(selection[field])
    return [field, [...prior.values()].filter(choice => selected.has(choice.Value))]
  }))
}
function PlanningFilters({ current, selection, captions, busy, select }: { current: PlannedFlowChoices | null; selection: PlannedFlowSelection;
  captions: PlanningCaptionCache; busy: boolean; select: (field: PlannedFlowField, keys: string[]) => void }) {
  const { t } = useI18n()
  return <>{plannedFlowFields.map(field => {
    const offered = current?.Fields.find(item => item.Field === field), fresh = offered?.Choices ?? []
    const keys = new Set(fresh.map(choice => choice.Value)), selected = new Set(selection[field])
    const retained = (captions[field] ?? []).filter(choice => selected.has(choice.Value) && !keys.has(choice.Value))
    return <MultiSelect key={field} label={t(plannedFlowFieldLabels[field])} value={selection[field]} searchable clearable limit={100} maxValues={256}
      data={[...fresh.map(choice => ({ value: choice.Value, label: choice.Caption, disabled: !offered?.Available })), ...retained.map(choice => ({ value: choice.Value, label: choice.Caption, disabled: true }))]}
      disabled={busy || !offered?.Available && !selection[field].length} placeholder={t('Усі; потрібні повні синхронізовані назви')}
      onChange={keys => select(field, keys)} />
  })}</>
}
function PlanningAvailability({ current, named }: { current: PlannedFlowChoices | null; named: boolean }) {
  const { t } = useI18n()
  return <>
    {current && !current.FullParentScopeVerified ? <Alert color="yellow">{t(dependencies[current.Code] ?? 'Повних даних планування й реквізитів документів ще немає.')}</Alert> : null}
    {!named ? <Alert color="yellow">{t('Назви або склад значень змінилися. Очистьте відбори й оновіть перелік назв.')}</Alert> : null}
  </>
}
function PlanningErrors({ periodError, previewError, namesError }: { periodError: string | null; previewError: string | null; namesError: string | null }) {
  const { t } = useI18n()
  return <>
    {periodError ? <Alert color="yellow">{t(periodError)}</Alert> : null}
    {previewError ? <Alert color="red">{t(previewError)}</Alert> : null}
    {namesError ? <Alert color="red">{t(namesError)}</Alert> : null}
  </>
}
export function OriginalPlannedCashFlowPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: PlannedFlowCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [measures, setMeasures] = useState<PlannedFlowMeasure[]>([...plannedFlowDefaults])
  const scope = useMemo(() => ({ capability, callerKey, canGenerate, from, through, measures }), [capability, callerKey, canGenerate, from, through, measures])
  const [selected, setSelected] = useState<{ scope: PlanningScope | null; values: PlannedFlowSelection }>({ scope: null, values: emptyPlannedFlowSelection() })
  const [choices, setChoices] = useState<{ scope: PlanningScope; result: PlannedFlowChoices; captions: PlanningCaptionCache } | null>(null)
  const selection = selected.scope === scope ? selected.values : emptyPlannedFlowSelection(), current = choices?.scope === scope ? choices.result : null
  const error = plannedFlowPeriodError(from, through) ?? (!measures.length ? 'Оберіть хоча б один показник.' : null)
  const allowed = canGenerate && !!callerKey && capability.Implemented, named = plannedFlowSelectedStillNamed(current, selection)
  const run = useOriginalDefaultPreview(JSON.stringify([scope, selection, current?.ChoicesWitnessSha256]), allowed && named, error,
    signal => readPlannedFlow(plannedFlowRequest(capability, from, through, measures, selection, current), signal))
  const load = useOriginalDefaultPreview(JSON.stringify(scope), allowed && capability.ScopedChoicesImplemented === true, error,
    signal => readPlannedFlowChoices(plannedFlowRequest(capability, from, through, measures), signal),
    result => { run.invalidate(); setChoices(previous => ({ scope, result, captions: retainedCaptions(previous, scope, selection) })) })
  const busy = run.isLoading || load.isLoading
  function invalidate() { run.invalidate(); load.invalidate() }
  function select(field: PlannedFlowField, keys: string[]) {
    const selectedKeys = new Set(selection[field]), offered = current?.Fields.find(item => item.Field === field)
    const offeredKeys = new Set(offered?.Choices.map(choice => choice.Value) ?? [])
    if (!keys.every(key => selectedKeys.has(key)) && (!offered?.Available || keys.some(key => !offeredKeys.has(key)))) return
    invalidate(); setSelected({ scope, values: { ...selection, [field]: keys } })
  }
  function reset() { invalidate(); setSelected({ scope, values: emptyPlannedFlowSelection() }); setChoices(null) }
  return <Stack gap="md"><Text>{t('Плани руху коштів: надходження, витрати й потік за статтями.')}</Text>
    <OriginalPeriodDateInputs from={from} through={through} busy={busy} changeFrom={value => { invalidate(); setFrom(value) }} changeThrough={value => { invalidate(); setThrough(value) }} />
    <MultiSelect label={t('Показники')} data={plannedFlowMeasures.map(measure => ({ value: measure, label: t(plannedFlowLabels[measure]) }))}
      value={measures} maxValues={6} disabled={busy} onChange={value => { invalidate(); setMeasures(value as PlannedFlowMeasure[]) }} />
    <PlanningFilters current={current} selection={selection} captions={choices?.scope === scope ? choices.captions : {}} busy={busy} select={select} />
    <Text size="sm" c="dimmed">{t('Поля з неповними назвами залишаються недоступними. Без відборів звіт охоплює всі сценарії, проєкти й підрозділи.')}</Text>
    <PlanningAvailability current={current} named={named} />
    <Button variant="light" loading={load.isLoading} disabled={!allowed || busy || !!error || capability.ScopedChoicesImplemented !== true} onClick={() => { run.invalidate(); void load.generate() }}>{t('Оновити назви відборів')}</Button>
    <Button variant="subtle" disabled={busy} onClick={reset}>{t('Очистити відбори й назви')}</Button>
    <Text size="sm" c="dimmed">{t(note)}</Text>
    <PlanningErrors periodError={error} previewError={run.error} namesError={load.error} />
    <Button loading={run.isLoading} disabled={!allowed || !named || busy || !!error} onClick={() => { void run.generate() }}>{t('Сформувати')}</Button>
    <PlannedFlowResultView result={run.lastRun} />
  </Stack>
}
