import { Alert, Button, Group, MultiSelect, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { cashMovementsFilters, cashMovementsLabels, emptyCashMovementsSelection, type CashMovementsCapability, type CashMovementsField,
  type CashMovementsResult, type CashMovementsSelection } from '../data/originalCashMovements'
import { cashMovementsCells, cashMovementsExportError, cashMovementsHeaders, cashMovementsLines } from '../data/originalCashMovementsExport'
import { cashMovementsFormats, useOriginalCashMovements } from '../hooks/useOriginalCashMovements'
import { OriginalSalesGrid } from './OriginalSalesGrid'
import { OriginalPeriodDateInputs } from './WarehousePeriodControls'
type Choice = { value: string; label: string }
type Choices = Record<CashMovementsField, Choice[]>
function fieldChoices(result: CashMovementsResult): Choices {
  return Object.fromEntries(cashMovementsFilters.map(field => [field, result.Choices[field].map(c => ({ value: c.Key, label: c.Caption }))])) as Choices
}
function CashMovementsGrid({ result }: { result: CashMovementsResult }) {
  const lines = useMemo(() => cashMovementsLines(result), [result]), headers = useMemo(() => cashMovementsHeaders(result), [result])
  return <OriginalSalesGrid lines={lines} headers={headers} hierarchyColumns={4} totals={result.Totals ? cashMovementsCells(result, result.Totals) : null} />
}
function CashMovementsOutcome({ result }: { result: CashMovementsResult | null }) {
  const { t } = useI18n()
  if (!result) return null
  if (!result.Available) return <Alert color="yellow">{t('Для звіту потрібні повні рухи коштів та підтверджені валюти рахунків за вибраний період. Часткові суми не показуються.')}
    {result.Dependency?.MissingMonth ? ` ${t('Відсутній місяць:')} ${result.Dependency.MissingMonth}` : null}</Alert>
  if (cashMovementsExportError(result)) return null
  return <Stack gap="xs">{result.MissingCaptionMappings.length ? <Text size="sm" c="dimmed">{t('Частину назв не зіставлено; усі підтверджені суми включено.')}</Text> : null}
    <CashMovementsGrid key={result.ResultSha256} result={result} /></Stack>
}
function CashMovementsFilters({ selected, choices, busy, change }: { selected: CashMovementsSelection; choices: Choices | null; busy: boolean;
  change: (field: CashMovementsField, values: string[]) => void }) {
  const { t } = useI18n()
  return <>{cashMovementsFilters.map(field => {
    const data = choices?.[field] ?? [], present = new Set(data.map(choice => choice.value))
    // Retain explicit keys even when a subsequent complete empty universe has no captions.
    const options = [...data, ...selected[field].filter(key => !present.has(key)).map(key => ({ value: key, label: t('Назва недоступна') }))]
    return <MultiSelect key={field} label={t(cashMovementsLabels[field])} placeholder={t('Усі; назви з’являться після формування')}
      data={options} value={selected[field]} searchable clearable maxValues={256} disabled={busy || !options.length}
      onChange={values => change(field, values)} />
  })}</>
}
export function OriginalCashMovementsPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: CashMovementsCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [selection, setSelection] = useState<{ scope: string; value: CashMovementsSelection }>({ scope: '', value: emptyCashMovementsSelection() })
  const [choices, setChoices] = useState<{ scope: string; value: Choices } | null>(null)
  const callerScope = JSON.stringify([callerKey, canGenerate, capability]), scope = JSON.stringify([callerScope, from, through])
  const selected = selection.scope === callerScope ? selection.value : emptyCashMovementsSelection(), currentChoices = choices?.scope === scope ? choices.value : null
  const key = JSON.stringify([scope, selected])
  const delivery = useOriginalCashMovements(capability, callerKey, canGenerate, from, through, selected, key, result => {
    if (result.Available) setChoices({ scope, value: fieldChoices(result) })
  })
  const result = delivery.run.lastRun, busy = delivery.run.isLoading || delivery.exporting, exportError = result?.Available ? cashMovementsExportError(result) : null
  return <Stack gap="md"><Text size="sm">{t('Рухи коштів: валюта → прихід / витрата → рахунок / каса → стаття. Колонки — вид коштів.')}</Text>
    <OriginalPeriodDateInputs from={from} through={through} busy={busy} changeFrom={value => { delivery.invalidate(); setFrom(value) }} changeThrough={value => { delivery.invalidate(); setThrough(value) }} />
    <CashMovementsFilters selected={selected} choices={currentChoices} busy={busy} change={(field, values) => {
      delivery.invalidate(); setSelection({ scope: callerScope, value: { ...selected, [field]: values } })
    }} />
    <Text size="sm" c="dimmed">{t('Сума у валюті рахунку / каси та управлінська сума — окремі збережені ресурси. Загальний підсумок об’єднує валюти без перерахунку.')}</Text>
    <Text size="sm" c="dimmed">{t('«—» означає відсутність внеску; 0.00 — спостережений нуль. Валюта «Не задано» є окремим відбором.')}</Text>
    {delivery.periodError ? <Alert color="yellow">{t(delivery.periodError)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    <Group><Button disabled={!delivery.permitted || !!delivery.periodError || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {cashMovementsFormats.map(format => <Button key={format} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!exportError}
        onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    <CashMovementsOutcome result={result} />
  </Stack>
}
