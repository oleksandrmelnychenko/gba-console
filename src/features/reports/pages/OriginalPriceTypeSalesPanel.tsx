import { Alert, Button, Checkbox, Group, MultiSelect, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getPriceSalesTypes, readPriceSales } from '../api/originalPriceTypeSalesApi'
import { priceSalesDefaults, priceSalesField, priceSalesFilters, priceSalesMeasures, priceSalesPeriodError, priceSalesRequest, type PriceSalesCapability,
  type PriceSalesChoice, type PriceSalesFilter, type PriceSalesMeasure, type PriceSalesResult, type PriceSalesSelection } from '../data/originalPriceTypeSales'
import { priceSalesCsv, priceSalesExportError, priceSalesHeaders, priceSalesLines, priceSalesPdf, priceSalesUnitNote, priceSalesValues, priceSalesXlsx } from '../data/originalPriceTypeSalesExport'
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
  const { t } = useI18n(), [page, setPage] = useState(0), lines = useMemo(() => priceSalesLines(result), [result]), headers = priceSalesHeaders(result)
  const current = Math.min(page, Math.max(0, Math.ceil(lines.length / 50) - 1)), start = current * 50
  return <Stack gap="xs"><Group><Button variant="light" disabled={!current} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text>{lines.length ? start + 1 : 0}–{Math.min(lines.length, start + 50)} / {lines.length}</Text>
    <Button variant="light" disabled={start + 50 >= lines.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1000}><Table striped><Table.Thead><Table.Tr>{headers.map(h => <Table.Th key={h}>{t(h)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{lines.slice(start, start + 50).map(line => <Table.Tr key={line.key} fw={line.subtotal ? 600 : undefined}>
        {line.cells.map((cell, i) => <Table.Td key={headers[i]} className={i >= 2 ? 'app-money' : undefined}>{cell}</Table.Td>)}
      </Table.Tr>)}</Table.Tbody>{result.Totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={2}>{t('Разом')}</Table.Th>
        {priceSalesValues(result, result.Totals).map((cell, i) => <Table.Td key={headers[i + 2]} className="app-money">{cell}</Table.Td>)}
      </Table.Tr></Table.Tfoot> : null}</Table></Table.ScrollContainer>{!lines.length ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}</Stack>
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
export function OriginalPriceTypeSalesPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: PriceSalesCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [measures, setMeasures] = useState<PriceSalesMeasure[]>(priceSalesDefaults as PriceSalesMeasure[])
  const callerScope = JSON.stringify([callerKey, canGenerate, capability]), [types, setTypes] = useState<{ scope: string; values: PriceSalesChoice[]; failed: boolean } | null>(null)
  const [price, setPrice] = useState({ scope: '', value: '' }), priceType = price.scope === callerScope ? price.value : ''
  useEffect(() => {
    if (!callerKey || !canGenerate || !capability.Executable) return
    const controller = new AbortController()
    getPriceSalesTypes(controller.signal).then(values => { if (!controller.signal.aborted) setTypes({ scope: callerScope, values, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setTypes({ scope: callerScope, values: [], failed: true }) })
    return () => controller.abort()
  }, [callerScope, callerKey, canGenerate, capability.Executable])
  const currentTypes = types?.scope === callerScope ? types : null
  const [selection, setSelection] = useState<{ scope: string; values: PriceSalesSelection }>({ scope: '', values: empty() })
  const [choices, setChoices] = useState<{ scope: string; values: Choices; fresh: Choices } | null>(null)
  const scope = JSON.stringify([callerScope, from, through, priceType]), current = choices?.scope === scope ? choices : null
  const selected = selection.scope === scope ? selection.values : empty(), key = JSON.stringify([scope, selected, measures])
  const delivery = usePriceSalesRun(capability, callerKey, canGenerate, from, through, priceType, selected, measures, key, result => {
    const fresh = result.Choices
    setChoices(previous => ({ scope, fresh, values: Object.fromEntries(priceSalesFilters.map(f => [f, retain(fresh[f], previous?.scope === scope ? previous.values[f] : [], selected[priceSalesField[f]])])) as Choices }))
  })
  const busy = delivery.run.isLoading || delivery.exporting, result = delivery.report
  function choose(field: PriceSalesFilter, values: string[]) {
    delivery.invalidate(); setSelection({ scope, values: { ...selected, [priceSalesField[field]]: values } })
    const kept = new Set(values), fresh = new Set(current?.fresh[field].map(c => c.Key) ?? [])
    setChoices(previous => previous?.scope === scope ? { ...previous, values: { ...previous.values, [field]: previous.values[field].filter(c => kept.has(c.Key) || fresh.has(c.Key)) } } : previous)
  }
  return <Stack gap="md"><Text>{t('Контрагент → товар. Чотири ресурси оригіналу за замовчуванням; сім додаткових ресурсів доступні окремо.')}</Text>
    <Group grow><TextInput type="date" label={t('Початок періоду')} value={from} disabled={busy} onChange={e => { delivery.invalidate(); setFrom(e.currentTarget.value) }} />
      <TextInput type="date" label={t('Кінець періоду (включно)')} value={through} disabled={busy} onChange={e => { delivery.invalidate(); setThrough(e.currentTarget.value) }} /></Group>
    <Select label={t('Тип ціни Fenix')} data={(currentTypes?.values ?? []).map(c => ({ value: c.Key, label: c.Caption }))} value={priceType || null} searchable clearable
      disabled={busy || !canGenerate || !callerKey || (!currentTypes?.values.length && !priceType)} onChange={v => { delivery.invalidate(); setPrice({ scope: callerScope, value: v ?? '' }) }} />
    {currentTypes?.failed || currentTypes && !currentTypes.values.length ? <Text>{t('Немає підтверджених назв типів цін у звичайних даних Fenix.')}</Text> : null}
    <Group grow>{priceSalesFilters.map(f => { const values = selected[priceSalesField[f]], options = current?.values[f] ?? []
      return <MultiSelect key={f} label={t(labels[f])} data={options.map(c => ({ value: c.Key, label: c.Caption }))} value={values} searchable clearable maxValues={256}
        disabled={busy || (!options.length && !values.length)} onChange={v => choose(f, v)} />
    })}</Group>
    <Group>{priceSalesMeasures.map(m => <Checkbox key={m} label={t(m)} checked={measures.includes(m)} disabled={busy} onChange={e => {
      delivery.invalidate(); const checked = e.currentTarget.checked; setMeasures(previous => priceSalesMeasures.filter(x => x === m ? checked : previous.includes(x)))
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
