import { Alert, Button, Checkbox, Group, MultiSelect, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { emptyMoneyFlowSelection, moneyFlowDefaults, moneyFlowDefinitions, moneyFlowFilters, moneyFlowHumanChoice, moneyFlowLabels,
  type MoneyFlowCapability, type MoneyFlowField, type MoneyFlowMeasure, type MoneyFlowResult, type MoneyFlowSelection } from '../data/originalMoneyFlowAnalysis'
import { moneyFlowCells, moneyFlowExportError, moneyFlowHeaders, moneyFlowLines } from '../data/originalMoneyFlowAnalysisExport'
import { moneyFlowFormats, useOriginalMoneyFlowAnalysis } from '../hooks/useOriginalMoneyFlowAnalysis'
import { OriginalSalesGrid } from './OriginalSalesGrid'
import { OriginalPeriodDateInputs } from './WarehousePeriodControls'
type Choice = { value: string; label: string }
type Choices = Record<MoneyFlowField, Choice[]>
function fieldChoices(result: MoneyFlowResult): Choices {
  return { Организация: result.Choices.Организация.filter(moneyFlowHumanChoice).map(c => ({ value: c.Key, label: c.Caption })),
    Подразделение: result.Choices.Подразделение.filter(moneyFlowHumanChoice).map(c => ({ value: c.Key, label: c.Caption })),
    Проект: result.Choices.Проект.filter(moneyFlowHumanChoice).map(c => ({ value: c.Key, label: c.Caption })) }
}
function MoneyFlowOutcome({ result }: { result: MoneyFlowResult | null }) {
  const { t } = useI18n()
  const lines = useMemo(() => result?.Available ? moneyFlowLines(result) : [], [result])
  if (!result) return null
  if (!result.Available) return <Alert color="yellow">{t('Потрібні повні звичайні рухи коштів і підтверджені атрибути документів за період. Часткові суми не показуються.')}</Alert>
  return <Stack gap="xs">{result.MissingCaptionMappings.length ? <Text size="sm" c="dimmed">{t('Частину назв не зіставлено; усі підтверджені суми включено.')}</Text> : null}
    <OriginalSalesGrid key={result.ResultSha256} lines={lines} headers={moneyFlowHeaders(result)} hierarchyColumns={2}
      totals={result.Totals ? moneyFlowCells(result, result.Totals) : null} /></Stack>
}
function MoneyFlowFilters({ selected, choices, busy, change }: { selected: MoneyFlowSelection; choices: Choices | null; busy: boolean;
  change: (field: MoneyFlowField, values: string[]) => void }) {
  const { t } = useI18n()
  return <>{moneyFlowFilters.map(field => {
    const options = choices?.[field] ?? []
    return <Stack key={field} gap={4}><MultiSelect label={t(moneyFlowLabels[field])} placeholder={t('Усі; лише підтверджені назви після формування')}
      data={options} value={selected[field]} searchable limit={100} clearable maxValues={256} disabled={busy || !options.length}
      onChange={values => change(field, values)} />
      {!options.length ? <Text size="xs" c="dimmed">{t('Назви для цього відбору недоступні у поточному періоді.')}</Text> : null}
      {selected[field].length ? <Button variant="subtle" size="compact-xs" disabled={busy} onClick={() => change(field, [])}>
        {t('Очистити відбір:')} {t(moneyFlowLabels[field])} ({selected[field].length})</Button> : null}</Stack>
  })}</>
}
function MoneyFlowMeasures({ selected, busy, change }: { selected: readonly MoneyFlowMeasure[]; busy: boolean; change: (measure: MoneyFlowMeasure, checked: boolean) => void }) {
  const { t } = useI18n(), set = new Set(selected)
  return <Group>{moneyFlowDefinitions.map(d => <Checkbox key={d.Key} label={t(d.Caption)} checked={set.has(d.Key)} disabled={busy}
    onChange={event => change(d.Key, event.currentTarget.checked)} />)}</Group>
}
export function OriginalMoneyFlowAnalysisPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: MoneyFlowCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [selection, setSelection] = useState<{ scope: string; value: MoneyFlowSelection }>({ scope: '', value: emptyMoneyFlowSelection() })
  const [measures, setMeasures] = useState<{ scope: string; value: MoneyFlowMeasure[] }>({ scope: '', value: [...moneyFlowDefaults] })
  const [choices, setChoices] = useState<{ scope: string; value: Choices } | null>(null)
  const callerScope = JSON.stringify([callerKey, canGenerate, capability]), scope = JSON.stringify([callerScope, from, through])
  const selected = selection.scope === callerScope ? selection.value : emptyMoneyFlowSelection()
  const selectedMeasures = measures.scope === callerScope ? measures.value : [...moneyFlowDefaults], currentChoices = choices?.scope === scope ? choices.value : null
  const key = JSON.stringify([scope, selected, selectedMeasures])
  const delivery = useOriginalMoneyFlowAnalysis(capability, callerKey, canGenerate, from, through, selected, selectedMeasures, key, result => {
    setChoices(result.Available ? { scope, value: fieldChoices(result) } : null)
  })
  const result = delivery.run.lastRun, busy = delivery.run.isLoading || delivery.exporting, exportError = result?.Available ? moneyFlowExportError(result) : null
  return <Stack gap="md"><Text size="sm">{t('Аналіз руху коштів: організація → стаття. Чотири початкові показники — прихід і чистий рух у двох збережених ресурсах.')}</Text>
    <OriginalPeriodDateInputs from={from} through={through} busy={busy} changeFrom={value => { delivery.invalidate(); setFrom(value) }} changeThrough={value => { delivery.invalidate(); setThrough(value) }} />
    <MoneyFlowFilters selected={selected} choices={currentChoices} busy={busy} change={(field, values) => {
      delivery.invalidate(); setSelection({ scope: callerScope, value: { ...selected, [field]: values } })
    }} />
    <MoneyFlowMeasures selected={selectedMeasures} busy={busy} change={(measure, checked) => {
      delivery.invalidate(); setMeasures({ scope: callerScope, value: checked ? [...selectedMeasures, measure] : selectedMeasures.filter(m => m !== measure) })
    }} />
    <Text size="sm" c="dimmed">{t('Суми у валюті рахунку / каси та управлінські суми не перераховуються між валютами. Чистий рух і всі підсумки обчислено сервером.')}</Text>
    <Text size="sm" c="dimmed">{t('«—» — відсутність внеску; 0.00 — спостережений нуль. Відповідність ефективного періоду та результату 1С не підтверджена.')}</Text>
    {delivery.periodError ? <Alert color="yellow">{t(delivery.periodError)}</Alert> : null}
    {!selectedMeasures.length ? <Alert color="yellow">{t('Виберіть хоча б один показник.')}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    <Group><Button disabled={!delivery.permitted || !!delivery.periodError || !selectedMeasures.length || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {moneyFlowFormats.map(format => <Button key={format} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!exportError}
        onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    <MoneyFlowOutcome result={result} />
  </Stack>
}
