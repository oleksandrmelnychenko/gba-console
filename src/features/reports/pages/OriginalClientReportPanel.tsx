import { Alert, Button, MultiSelect, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readClientReport } from '../api/originalClientReportApi'
import { clientFieldLabels, clientFieldSelectable, clientFields, clientMeasureLabels, clientMeasures, clientPeriodError, clientRequest, emptyClientSelection,
  type ClientCapability, type ClientChoice, type ClientField, type ClientResult, type ClientRow, type ClientSelection } from '../data/originalClientReport'
import type { OriginalDefaultLine, OriginalDefaultSheet } from '../data/originalDefaultReportExport'
import { useOriginalDefaultPreview } from '../hooks/useOriginalDefaultPreview'
import { OriginalDefaultReportOutput } from './OriginalDefaultReportOutput'
import { OriginalPeriodDateInputs } from './WarehousePeriodControls'

const note = 'Збережені знакові управлінські суми, оплати й кількості без додавання ПДВ та валютного перерахунку. Додаткові групування, одиниці звіту та всі правила 1С ще не підтверджені.'
function clientSheet(result: ClientResult): OriginalDefaultSheet {
  const lines: OriginalDefaultLine[] = []
  function level(rows: ClientRow[], parents: string[], keys: string[]) {
    for (const row of rows) {
      const labels = [...parents, row.Caption], path = [...keys, row.Key]
      lines.push({ key: path.join('|'), subtotal: row.Children.length > 0, cells: [...labels, ...Array<string>(3 - labels.length).fill(''), ...clientMeasures.map(measure => row.Values[measure])] })
      level(row.Children, labels, path)
    }
  }
  level(result.Rows, [], [])
  return { title: 'Звіт за клієнтами', from: result.From, through: result.Through, note, labelColumns: 3,
    headers: ['Організація', 'Контрагент', 'Договір', ...clientMeasureLabels], lines,
    total: result.Totals ? ['Разом', '', '', ...clientMeasures.map(measure => result.Totals![measure])] : null }
}
function ClientResultView({ result }: { result: ClientResult | null }) {
  const { t } = useI18n(), output = useMemo(() => result?.Available ? clientSheet(result) : null, [result])
  if (!result) return null
  if (!output) return <Alert color="yellow">{t('Повний початковий борг і всі потрібні рухи, реквізити та статуси ще не синхронізовані; частковий звіт не формується.')}
    {result.MissingMonth ? ` ${result.MissingMonth}` : ''}</Alert>
  return <>{clientFields.some(field => result.Choices[field]?.some(choice => !choice.CaptionAvailable)) ? <Text size="sm">{t('Частина назв недоступна. Усі окремі групи й суми збережено; відбір для поля з неповними назвами вимкнено.')}</Text> : null}
    <OriginalDefaultReportOutput key={result.ResultSha256} sheet={output} filename="client-report" /></>
}
function selectedStillNamed(result: ClientResult | null, selected: ClientSelection) {
  return clientFields.every(field => !selected[field].length || clientFieldSelectable(result, field)
    && selected[field].every(key => result?.Choices[field]?.some(choice => choice.Key === key)))
}
type CaptionCache = Partial<Record<ClientField, ClientChoice[]>>
function selectedCaptions(previous: { scope: string; result: ClientResult; captions: CaptionCache } | null, scope: string, selection: ClientSelection): CaptionCache {
  return Object.fromEntries(clientFields.map(field => {
    if (previous?.scope !== scope) return [field, []]
    const prior = new Map([...(previous.captions[field] ?? []), ...(previous.result.Choices[field] ?? [])].map(choice => [choice.Key, choice]))
    return [field, [...prior.values()].filter(choice => choice.CaptionAvailable && selection[field].includes(choice.Key))]
  }))
}
function options(current: ClientResult | null, field: ClientField, selection: ClientSelection, captions: CaptionCache) {
  const fresh = (current?.Choices[field] ?? []).filter(choice => choice.CaptionAvailable), keys = new Set(fresh.map(choice => choice.Key))
  const retained = (captions[field] ?? []).filter(choice => selection[field].includes(choice.Key) && !keys.has(choice.Key))
  return [...fresh.map(choice => ({ value: choice.Key, label: choice.Caption, disabled: !clientFieldSelectable(current, field) })), ...retained.map(choice => ({ value: choice.Key, label: choice.Caption, disabled: true }))]
}
function ClientFilters({ current, selection, captions, busy, select }: { current: ClientResult | null; selection: ClientSelection; captions: CaptionCache; busy: boolean;
  select: (field: ClientField, keys: string[]) => void }) {
  const { t } = useI18n()
  return <>{clientFields.map(field => <MultiSelect key={field} label={t(clientFieldLabels[field])} value={selection[field]}
    data={options(current, field, selection, captions)}
    disabled={busy || !clientFieldSelectable(current, field) && !selection[field].length} searchable clearable limit={100} maxValues={256}
    placeholder={t('Усі; повні назви з’являться після формування')} onChange={keys => select(field, keys)} />)}</>
}
export function OriginalClientReportPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: ClientCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [selected, setSelected] = useState<{ scope: string; values: ClientSelection }>({ scope: '', values: emptyClientSelection() })
  const [choices, setChoices] = useState<{ scope: string; result: ClientResult; captions: CaptionCache } | null>(null)
  const scope = JSON.stringify([capability, callerKey, canGenerate, from, through])
  const selection = selected.scope === scope ? selected.values : emptyClientSelection(), current = choices?.scope === scope ? choices.result : null
  const error = clientPeriodError(from, through), named = selectedStillNamed(current, selection), allowed = canGenerate && !!callerKey && capability.Executable
  const key = JSON.stringify([scope, selection])
  const run = useOriginalDefaultPreview(key, allowed && named, error, signal => readClientReport(clientRequest(capability, from, through, selection), signal),
    result => setChoices(previous => ({ scope, result, captions: selectedCaptions(previous, scope, selection) })))
  function select(field: ClientField, keys: string[]) {
    const removing = keys.every(key => selection[field].includes(key))
    if (!removing && (!clientFieldSelectable(current, field) || keys.some(key => !current?.Choices[field]?.some(choice => choice.Key === key)))) return
    run.invalidate(); setSelected({ scope, values: { ...selection, [field]: keys } })
  }
  function reset() { run.invalidate(); setSelected({ scope, values: emptyClientSelection() }); setChoices(null) }
  return <Stack gap="md"><Text>{t('Організація → контрагент → договір. Початковий і кінцевий борг, оплати, прихід та витрата у початковому компонуванні.')}</Text>
    <OriginalPeriodDateInputs from={from} through={through} busy={run.isLoading} changeFrom={value => { run.invalidate(); setFrom(value) }} changeThrough={value => { run.invalidate(); setThrough(value) }} />
    <ClientFilters current={current} selection={selection} captions={choices?.scope === scope ? choices.captions : {}} busy={run.isLoading} select={select} />
    <Text size="sm" c="dimmed">{t(note)}</Text>
    {error ? <Alert color="yellow">{t(error)}</Alert> : null}{run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    {!named ? <Alert color="yellow">{t('Назви або склад значень змінилися. Очистьте відбори й сформуйте звіт повторно.')}</Alert> : null}
    <Button variant="light" disabled={run.isLoading} onClick={reset}>{t('Очистити відбори й назви')}</Button>
    <Button loading={run.isLoading} disabled={!allowed || !named || run.isLoading || !!error} onClick={() => { void run.generate() }}>{t('Сформувати')}</Button>
    <ClientResultView result={run.lastRun} />
  </Stack>
}
