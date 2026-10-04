import { Alert, Button, Checkbox, Group, MultiSelect, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readSales } from '../api/originalSalesApi'
import { salesDefaults, salesField, salesFilters, salesMeasures, salesPeriodError, salesRequest, type SalesCapability,
  type SalesChoice, type SalesFilter, type SalesMeasure, type SalesResult, type SalesSelection } from '../data/originalSales'
import { salesCsv, salesExportError, salesHeaders, salesLines, salesPdf, salesUnitNote, salesValues, salesXlsx } from '../data/originalSalesExport'
import { OriginalSalesGrid } from './OriginalSalesGrid'
import { useReportRunState } from '../hooks/useReportRunState'
const formats = ['csv', 'xlsx', 'pdf'] as const
const labels = { 'Контрагент': 'Контрагенти', 'Номенклатура': 'Товари', 'Проект': 'Проєкти', 'Подразделение': 'Підрозділи' }
const empty = (): SalesSelection => ({ Counterparties: [], Products: [], Projects: [], Divisions: [] })
type Choices = Record<SalesFilter, SalesChoice[]>
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000) }
function retain(current: SalesChoice[], previous: SalesChoice[], selected: string[]) {
  const ids = new Set(current.map(c => c.Key)), kept = new Set(selected)
  return [...current, ...previous.filter(c => kept.has(c.Key) && !ids.has(c.Key))]
}
function SalesTable({ result }: { result: SalesResult }) {
  const lines = useMemo(() => salesLines(result), [result])
  return <OriginalSalesGrid lines={lines} headers={salesHeaders(result)} totals={result.Totals ? salesValues(result, result.Totals) : null} />
}
function useSalesRun(capability: SalesCapability, caller: string | null, allowed: boolean, from: string, through: string,
  selection: SalesSelection, measures: SalesMeasure[], key: string, accept: (r: SalesResult) => void) {
  const run = useReportRunState<SalesResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key), [exporting, setExporting] = useState(false)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const permitted = allowed && !!caller && capability.Executable, error = salesPeriodError(from, through) ?? (!measures.length ? 'Оберіть хоча б один ресурс.' : null), report = run.lastRun
  function invalidate() { latest.current = ''; active.current?.abort(); run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    active.current?.abort(); const controller = new AbortController(); active.current = controller; latest.current = key; const update = run.begin()
    try { const value = await readSales(salesRequest(capability, from, through, selection, measures), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: value }); if (value.NormalInputsComplete) accept(value)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    if (!permitted || !report?.Available || exporting || salesExportError(report)) return
    setExporting(true)
    try { const blob = format === 'csv' ? new Blob([salesCsv(report)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await salesXlsx(report) : await salesPdf(report)
      if (latest.current === key) download(blob, `sales-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, permitted, error, report, exporting, invalidate, generate, exportFile }
}
export function OriginalSalesPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: SalesCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [measures, setMeasures] = useState<SalesMeasure[]>(salesDefaults as SalesMeasure[])
  const callerScope = JSON.stringify([callerKey, canGenerate, capability])
  const [selection, setSelection] = useState<{ scope: string; values: SalesSelection }>({ scope: '', values: empty() })
  const [choices, setChoices] = useState<{ scope: string; values: Choices; fresh: Choices } | null>(null)
  const scope = JSON.stringify([callerScope, from, through]), current = choices?.scope === scope ? choices : null
  const selected = selection.scope === scope ? selection.values : empty(), key = JSON.stringify([scope, selected, measures])
  const delivery = useSalesRun(capability, callerKey, canGenerate, from, through, selected, measures, key, result => {
    const fresh = result.Choices
    setChoices(previous => ({ scope, fresh, values: Object.fromEntries(salesFilters.map(f => [f, retain(fresh[f], previous?.scope === scope ? previous.values[f] : [], selected[salesField[f]])])) as Choices }))
  })
  const busy = delivery.run.isLoading || delivery.exporting, result = delivery.report
  const selectedMeasures = new Set(measures)
  function choose(field: SalesFilter, values: string[]) {
    delivery.invalidate(); setSelection({ scope, values: { ...selected, [salesField[field]]: values } })
    const kept = new Set(values), fresh = new Set(current?.fresh[field].map(c => c.Key) ?? [])
    setChoices(previous => previous?.scope === scope ? { ...previous, values: { ...previous.values, [field]: previous.values[field].filter(c => kept.has(c.Key) || fresh.has(c.Key)) } } : previous)
  }
  return <Stack gap="md"><Text>{t('Контрагент → товар. Два ресурси оригіналу за замовчуванням; сім додаткових ресурсів доступні окремо.')}</Text>
    <Group grow><TextInput type="date" label={t('Початок періоду')} value={from} disabled={busy} onChange={e => { delivery.invalidate(); setFrom(e.currentTarget.value) }} />
      <TextInput type="date" label={t('Кінець періоду (включно)')} value={through} disabled={busy} onChange={e => { delivery.invalidate(); setThrough(e.currentTarget.value) }} /></Group>
    <Group grow>{salesFilters.map(f => { const values = selected[salesField[f]], options = current?.values[f] ?? []
      return <MultiSelect key={f} label={t(labels[f])} data={options.map(c => ({ value: c.Key, label: c.Caption }))} value={values} searchable clearable maxValues={256}
        disabled={busy || (!options.length && !values.length)} onChange={v => choose(f, v)} />
    })}</Group>
    <Group>{salesMeasures.map(m => <Checkbox key={m} label={t(m)} checked={selectedMeasures.has(m)} disabled={busy} onChange={e => {
      delivery.invalidate(); const checked = e.currentTarget.checked; setMeasures(previous => { const selected = new Set(previous); return salesMeasures.filter(x => x === m ? checked : selected.has(x)) })
    }} />)}</Group>
    <Text size="sm" c="dimmed">{t(salesUnitNote)}</Text>{delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <Group><Button loading={delivery.run.isLoading} disabled={!delivery.permitted || !!delivery.error || busy} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(f => <Button key={f} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!salesExportError(result)} onClick={() => { void delivery.exportFile(f) }}>{f.toUpperCase()}</Button>)}</Group>
    {result && !result.Available ? <Alert color="yellow">{t('Для повного звіту потрібні всі місячні продажі й точні одиниці вибраних товарів. Часткові суми не підставляються.')}
      {result.Dependency?.MissingMonth ? ` ${result.Dependency.MissingMonth}` : ''}</Alert> : null}
    {result?.Available ? <>{result.MissingCaptionMappings.length ? <Text>{t('Частина назв і відборів недоступна; всі ключі та суми збережено окремо.')}</Text> : null}
      <SalesTable key={result.ResultSha256} result={result} /></> : null}
  </Stack>
}
