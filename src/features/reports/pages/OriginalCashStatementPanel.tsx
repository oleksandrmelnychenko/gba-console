import { Alert, Button, Checkbox, Group, MultiSelect, Stack, Table, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readOriginalCashStatement } from '../api/originalCashStatementApi'
import { cashAccountKey, cashFields, cashFilterKey, cashLabels, cashRequest, type CashCapability, type CashChoice, type CashField, type CashFilter, type CashResult } from '../data/originalCashStatement'
import { cashCsv, cashExportError, cashHeaders, cashPdf, cashValues, cashXlsx } from '../data/originalCashStatementExport'
import { plannedPeriodError } from '../data/originalPlannedCash'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalPeriodDateInputs } from './WarehousePeriodControls'
const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function CashSelections({ choices, filters, busy, select }: { choices: CashChoice[]; filters: CashFilter[]; busy: boolean; select: (field: CashField, values: string[]) => void }) {
  const { t } = useI18n()
  return cashFields.map(field => {
    const options = choices.filter(choice => choice.Value.Field === field).map(choice => ({ value: cashFilterKey(choice.Value), label: choice.Caption }))
    const values = filters.filter(filter => filter.Field === field).map(cashFilterKey)
    return <MultiSelect key={field} label={t(cashLabels[field])} data={options} value={values} searchable clearable maxValues={256} limit={50}
      disabled={busy || (!options.length && !values.length)} clearButtonProps={{ 'aria-label': `${t('Очистити')} ${t(cashLabels[field])}` }}
      placeholder={t(options.length ? 'Усі; оберіть потрібні значення' : 'Підтверджені назви ще недоступні')} onChange={keys => select(field, keys)} />
  })
}
function CashTable({ result }: { result: CashResult }) {
  const { t } = useI18n(), [page, setPage] = useState(0), headers = cashHeaders(result.IncludeTurnover)
  const current = Math.min(page, Math.max(0, Math.ceil(result.Rows.length / 50) - 1)), first = current * 50
  return <Stack gap="xs"><Group><Button size="xs" variant="light" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text size="xs">{result.Rows.length ? first + 1 : 0}–{Math.min(first + 50, result.Rows.length)} / {result.Rows.length}</Text>
    <Button size="xs" variant="light" disabled={first + 50 >= result.Rows.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1400}><Table><Table.Thead><Table.Tr>{headers.map(header => <Table.Th key={header}>{t(header)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{result.Rows.slice(first, first + 50).map(row => <Table.Tr key={cashAccountKey(row.Account)}><Table.Td>{row.Caption ?? t('Назва недоступна')}</Table.Td>
        {cashValues(row.Amounts, result.IncludeTurnover).map((value, column) => <Table.Td key={headers[column + 1]} className="app-money">{value}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
      {result.Totals ? <Table.Tfoot><Table.Tr><Table.Th>{t('Разом')}</Table.Th>{cashValues(result.Totals, result.IncludeTurnover).map((value, column) => <Table.Td key={headers[column + 1]} className="app-money">{value}</Table.Td>)}</Table.Tr></Table.Tfoot> : null}
    </Table></Table.ScrollContainer>{!result.Rows.length ? <Text>{t('У повністю перевіреному періоді рядків немає.')}</Text> : null}</Stack>
}
function useCashRun({ capability, callerKey, canGenerate, from, through, filters, turnover, key, receive }: {
  capability: CashCapability; callerKey: string | null; canGenerate: boolean; from: string; through: string; filters: CashFilter[]; turnover: boolean; key: string; receive: (result: CashResult) => void
}) {
  const run = useReportRunState<CashResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key), [exporting, setExporting] = useState(false)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const allowed = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix', error = plannedPeriodError(from, through), result = run.lastRun
  function invalidate() { latest.current = ''; active.current?.abort(); run.clear() }
  async function generate() {
    if (!allowed || error || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; latest.current = key; const update = run.begin()
    try {
      const response = await readOriginalCashStatement(cashRequest(capability, from, through, filters, turnover), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: response }); if (response.Available) receive(response)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати відомість коштів.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    if (!allowed || !result?.Available || exporting || cashExportError(result)) return
    setExporting(true)
    try {
      const file = format === 'csv' ? new Blob([cashCsv(result)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await cashXlsx(result) : await cashPdf(result)
      if (latest.current === key) download(file, `cash-statement-${result.From}-${result.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, result, allowed, error, exporting, invalidate, generate, exportFile, exportError: result?.Available ? cashExportError(result) : null }
}
function CashResult({ result, exportError }: { result: CashResult | null; exportError: string | null }) {
  const { t } = useI18n()
  if (!result) return null
  if (!result.Available) return <Alert color="yellow">{t(result.Code === 'original_cash_statement_currency_attribute_unavailable'
    ? 'Для всіх відібраних рахунків ще не синхронізовані точні реквізити валюти. Відбір не застосовується частково.'
    : 'Повного узгодженого початкового залишку та рухів цього періоду немає; часткова відомість не формується.')}</Alert>
  return <Stack gap="xs">{result.MissingCaptionMappings.length ? <Text size="sm" c="dimmed">{t('Деякі назви ще недоступні. Усі суми збережено; технічні посилання не використовуються як назви.')}</Text> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}<CashTable key={result.ResultSha256} result={result} /></Stack>
}
export function OriginalCashStatementPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: CashCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough), [turnover, setTurnover] = useState(false)
  const [selection, setSelection] = useState<{ scope: string; filters: CashFilter[] }>({ scope: '', filters: [] })
  const [choiceState, setChoiceState] = useState<{ scope: string; choices: CashChoice[]; retained: CashChoice[] } | null>(null)
  const scope = JSON.stringify([callerKey, canGenerate, capability, from, through]), filters = selection.scope === scope ? selection.filters : [], applied = new Set(filters.map(cashFilterKey))
  const current = choiceState?.scope === scope ? choiceState : null
  const choices = [...(current?.choices ?? []), ...(current?.retained.filter(choice => applied.has(cashFilterKey(choice.Value))) ?? [])]
  const key = JSON.stringify([scope, filters, turnover]), delivery = useCashRun({ capability, callerKey, canGenerate, from, through, filters, turnover, key,
    receive: response => setChoiceState(previous => {
      const fresh = new Set(response.Choices.map(choice => cashFilterKey(choice.Value))), prior = previous?.scope === scope ? [...previous.choices, ...previous.retained] : []
      return { scope, choices: response.Choices, retained: prior.filter(choice => applied.has(cashFilterKey(choice.Value)) && !fresh.has(cashFilterKey(choice.Value))) }
    }) })
  const busy = delivery.run.isLoading || delivery.exporting
  function select(field: CashField, keys: string[]) {
    const wanted = new Set(keys), available = choices.filter(choice => choice.Value.Field === field && wanted.has(cashFilterKey(choice.Value)))
    delivery.invalidate(); setSelection({ scope, filters: [...filters.filter(filter => filter.Field !== field), ...available.map(choice => choice.Value)] })
  }
  return <Stack gap="md"><Text>{t('Відомість коштів Fenix за період: банківський рахунок / каса.')}</Text>
    <OriginalPeriodDateInputs from={from} through={through} busy={busy} changeFrom={value => { delivery.invalidate(); setFrom(value) }} changeThrough={value => { delivery.invalidate(); setThrough(value) }} />
    <CashSelections choices={choices} filters={filters} busy={busy} select={select} />
    <Group><Checkbox label={t('Додати обороти')} checked={turnover} disabled={busy} onChange={event => { delivery.invalidate(); setTurnover(event.currentTarget.checked) }} />
      <Button loading={delivery.run.isLoading} disabled={!delivery.allowed || !!delivery.error || busy} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(format => <Button key={format} variant="light" disabled={!delivery.allowed || !delivery.result?.Available || busy || !!delivery.exportError} onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    <Text size="sm" c="dimmed">{t('Власна та управлінська суми у записаних одиницях, без валютного перерахунку. Період включає 00:00:00…23:59:59. Нульові спостережені рядки збережено; повна відповідність 1С ще не підтверджена.')}</Text>
    {delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}{delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <CashResult result={delivery.result} exportError={delivery.exportError} />
  </Stack>
}
