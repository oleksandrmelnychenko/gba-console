import { Alert, Button, MultiSelect, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readPlannedFlow } from '../api/originalPlannedCashFlowApi'
import { plannedFlowDefaults, plannedFlowLabels, plannedFlowMeasures, plannedFlowPeriodError, plannedFlowRequest,
  type PlannedFlowCapability, type PlannedFlowMeasure, type PlannedFlowResult } from '../data/originalPlannedCashFlow'
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
export function OriginalPlannedCashFlowPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: PlannedFlowCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [measures, setMeasures] = useState<PlannedFlowMeasure[]>([...plannedFlowDefaults])
  const error = plannedFlowPeriodError(from, through) ?? (!measures.length ? 'Оберіть хоча б один показник.' : null)
  const allowed = canGenerate && !!callerKey && capability.Implemented
  const key = JSON.stringify([capability, callerKey, canGenerate, from, through, measures])
  const run = useOriginalDefaultPreview(key, allowed, error, signal => readPlannedFlow(plannedFlowRequest(capability, from, through, measures), signal))
  return <Stack gap="md"><Text>{t('Плани руху коштів: надходження, витрати й потік за статтями.')}</Text>
    <OriginalPeriodDateInputs from={from} through={through} busy={run.isLoading} changeFrom={value => { run.invalidate(); setFrom(value) }} changeThrough={value => { run.invalidate(); setThrough(value) }} />
    <MultiSelect label={t('Показники')} data={plannedFlowMeasures.map(measure => ({ value: measure, label: t(plannedFlowLabels[measure]) }))}
      value={measures} maxValues={6} disabled={run.isLoading} onChange={value => { run.invalidate(); setMeasures(value as PlannedFlowMeasure[]) }} />
    {['Сценарій', 'Проєкт', 'Підрозділ'].map(label => <MultiSelect key={label} label={t(label)} data={[]} value={[]} disabled placeholder={t('Назви для відбору ще недоступні')} />)}
    <Text size="sm" c="dimmed">{t('Звіт охоплює всі сценарії, проєкти й підрозділи. Відбір за ними стане доступним після підтвердження повних назв.')}</Text>
    <Text size="sm" c="dimmed">{t(note)}</Text>
    {error ? <Alert color="yellow">{t(error)}</Alert> : null}{run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Button loading={run.isLoading} disabled={!allowed || run.isLoading || !!error} onClick={() => { void run.generate() }}>{t('Сформувати')}</Button>
    <PlannedFlowResultView result={run.lastRun} />
  </Stack>
}
