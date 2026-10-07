import { Alert, Button, Checkbox, Group, MultiSelect, Select, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getPriceSalesTypes, readPriceSales } from '../api/originalPriceTypeSalesApi'
import { priceSalesDefaults, priceSalesField, priceSalesFilters, priceSalesMeasures, priceSalesPeriodError, priceSalesRequest, type PriceSalesCapability,
  type PriceSalesChoice, type PriceSalesFilter, type PriceSalesMeasure, type PriceSalesResult, type PriceSalesSelection } from '../data/originalPriceTypeSales'
import { priceSalesCsv, priceSalesExportError, priceSalesHeaders, priceSalesLines, priceSalesPdf, priceSalesUnitNote, priceSalesValues, priceSalesXlsx } from '../data/originalPriceTypeSalesExport'
import { OriginalSalesGrid } from './OriginalSalesGrid'
import { useReportRunState } from '../hooks/useReportRunState'
const formats = ['csv', 'xlsx', 'pdf'] as const
const labels = { 'Контрагент': 'Контрагенти', 'Номенклатура': 'Товари', 'Проект': 'Проєкти', 'Подразделение': 'Підрозділи' }
const empty = (): PriceSalesSelection => ({ Counterparties: [], Products: [], Projects: [], Divisions: [] })
type Choices = Record<PriceSalesFilter, PriceSalesChoice[]>
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000) }
function retain(current: PriceSalesChoice[], previous: PriceSalesChoice[], selected: string[]) {
  const ids = new Set(current.map(c => c.Key)), kept = new Set(selected)
  return [...current, ...previous.filter(c => kept.has(c.Key) && !ids.has(c.Key))]
}
function PriceSalesTable({ result }: { result: PriceSalesResult }) {
  const lines = useMemo(() => priceSalesLines(result), [result])
  return <OriginalSalesGrid lines={lines} headers={priceSalesHeaders(result)} totals={result.Totals ? priceSalesValues(result, result.Totals) : null} />
}
function usePriceSalesRun(capability: PriceSalesCapability, caller: string | null, allowed: boolean, from: string, through: string, priceType: string,
  selection: PriceSalesSelection, measures: PriceSalesMeasure[], key: string, accept: (r: PriceSalesResult) => void) {
  const run = useReportRunState<PriceSalesResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key), [exporting, setExporting] = useState(false)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const permitted = allowed && !!caller && capability.Executable, error = priceSalesPeriodError(from, through) ?? (!priceType ? 'Оберіть названий тип ціни Fenix.' : !measures.length ? 'Оберіть хоча б один ресурс.' : null), report = run.lastRun
  function invalidate() { latest.current = ''; active.current?.abort(); run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    active.current?.abort(); const controller = new AbortController(); active.current = controller; latest.current = key; const update = run.begin()
    try { const value = await readPriceSales(priceSalesRequest(capability, from, through, priceType, selection, measures), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: value }); if (value.NormalInputsComplete) accept(value)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати порівняння.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    if (!permitted || !report?.Available || exporting || priceSalesExportError(report)) return
    setExporting(true)
    try { const blob = format === 'csv' ? new Blob([priceSalesCsv(report)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await priceSalesXlsx(report) : await priceSalesPdf(report)
      if (latest.current === key) download(blob, `price-type-sales-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, permitted, error, report, exporting, invalidate, generate, exportFile }
}
function useNamedPriceSalesTypes(callerScope: string, callerKey: string | null, canGenerate: boolean, executable: boolean) {
  const [types, setTypes] = useState<{ scope: string; values: PriceSalesChoice[]; failed: boolean } | null>(null)
  useEffect(() => {
    if (!callerKey || !canGenerate || !executable) return
    const controller = new AbortController()
    getPriceSalesTypes(controller.signal).then(values => { if (!controller.signal.aborted) setTypes({ scope: callerScope, values, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setTypes({ scope: callerScope, values: [], failed: true }) })
    return () => controller.abort()
  }, [callerScope, callerKey, canGenerate, executable])
  return types?.scope === callerScope ? types : null
}
function NamedPriceSalesType({ current, priceType, busy, canGenerate, callerKey, onChange }: {
  current: { values: PriceSalesChoice[]; failed: boolean } | null; priceType: string; busy: boolean;
  canGenerate: boolean; callerKey: string | null; onChange: (value: string | null) => void
}) {
  const { t } = useI18n()
  return <><Select label={t('Тип ціни Fenix')} data={(current?.values ?? []).map(c => ({ value: c.Key, label: c.Caption }))} value={priceType || null} searchable clearable
    disabled={busy || !canGenerate || !callerKey || (!current?.values.length && !priceType)} onChange={onChange} />
    {current?.failed || current && !current.values.length ? <Text>{t('Немає підтверджених назв типів цін у звичайних даних Fenix.')}</Text> : null}</>
}
export function OriginalPriceTypeSalesPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: PriceSalesCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [measures, setMeasures] = useState<PriceSalesMeasure[]>(priceSalesDefaults as PriceSalesMeasure[])
  const callerScope = JSON.stringify([callerKey, canGenerate, capability])
  const [price, setPrice] = useState({ scope: '', value: '' }), priceType = price.scope === callerScope ? price.value : ''
  const currentTypes = useNamedPriceSalesTypes(callerScope, callerKey, canGenerate, capability.Executable)
  const [selection, setSelection] = useState<{ scope: string; values: PriceSalesSelection }>({ scope: '', values: empty() })
  const [choices, setChoices] = useState<{ scope: string; values: Choices; fresh: Choices } | null>(null)
  const scope = JSON.stringify([callerScope, from, through, priceType]), current = choices?.scope === scope ? choices : null
  const selected = selection.scope === scope ? selection.values : empty(), key = JSON.stringify([scope, selected, measures])
  const delivery = usePriceSalesRun(capability, callerKey, canGenerate, from, through, priceType, selected, measures, key, result => {
    const fresh = result.Choices
    setChoices(previous => ({ scope, fresh, values: Object.fromEntries(priceSalesFilters.map(f => [f, retain(fresh[f], previous?.scope === scope ? previous.values[f] : [], selected[priceSalesField[f]])])) as Choices }))
  })
  const busy = delivery.run.isLoading || delivery.exporting, result = delivery.report
  const selectedMeasures = new Set(measures)
  function choose(field: PriceSalesFilter, values: string[]) {
    delivery.invalidate(); setSelection({ scope, values: { ...selected, [priceSalesField[field]]: values } })
    const kept = new Set(values), fresh = new Set(current?.fresh[field].map(c => c.Key) ?? [])
    setChoices(previous => previous?.scope === scope ? { ...previous, values: { ...previous.values, [field]: previous.values[field].filter(c => kept.has(c.Key) || fresh.has(c.Key)) } } : previous)
  }
  return <Stack gap="md"><Text>{t('Контрагент → товар. Чотири ресурси оригіналу за замовчуванням; сім додаткових ресурсів доступні окремо.')}</Text>
    <Group grow><TextInput type="date" label={t('Початок періоду')} value={from} disabled={busy} onChange={e => { delivery.invalidate(); setFrom(e.currentTarget.value) }} />
      <TextInput type="date" label={t('Кінець періоду (включно)')} value={through} disabled={busy} onChange={e => { delivery.invalidate(); setThrough(e.currentTarget.value) }} /></Group>
    <NamedPriceSalesType current={currentTypes} priceType={priceType} busy={busy} canGenerate={canGenerate} callerKey={callerKey}
      onChange={v => { delivery.invalidate(); setPrice({ scope: callerScope, value: v ?? '' }) }} />
    <Group grow>{priceSalesFilters.map(f => { const values = selected[priceSalesField[f]], options = current?.values[f] ?? []
      return <MultiSelect key={f} label={t(labels[f])} data={options.map(c => ({ value: c.Key, label: c.Caption }))} value={values} searchable clearable maxValues={256}
        disabled={busy || (!options.length && !values.length)} onChange={v => choose(f, v)} />
    })}</Group>
    <Group>{priceSalesMeasures.map(m => <Checkbox key={m} label={t(m)} checked={selectedMeasures.has(m)} disabled={busy} onChange={e => {
      delivery.invalidate(); const checked = e.currentTarget.checked; setMeasures(previous => { const selected = new Set(previous); return priceSalesMeasures.filter(x => x === m ? checked : selected.has(x)) })
    }} />)}</Group>
    <Text size="sm" c="dimmed">{t(priceSalesUnitNote)}</Text>{delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <Group><Button loading={delivery.run.isLoading} disabled={!delivery.permitted || !!delivery.error || busy} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(f => <Button key={f} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!priceSalesExportError(result)} onClick={() => { void delivery.exportFile(f) }}>{f.toUpperCase()}</Button>)}</Group>
    {result && !result.Available ? <Alert color="yellow">{t('Для повного звіту потрібні всі місячні продажі, історія обраного типу ціни й точні одиниці вибраних товарів. Часткові суми не підставляються.')}
      {result.Dependency?.MissingMonth ? ` ${result.Dependency.MissingMonth}` : ''}</Alert> : null}
    {result?.Available ? <>{result.MissingCaptionMappings.length ? <Text>{t('Частина назв і відборів недоступна; всі ключі та суми збережено окремо.')}</Text> : null}
      <PriceSalesTable key={result.ResultSha256} result={result} /></> : null}
  </Stack>
}
