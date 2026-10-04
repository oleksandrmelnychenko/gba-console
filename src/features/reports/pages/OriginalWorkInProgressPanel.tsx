import { Alert, Button, Checkbox, Group, MultiSelect, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readWip } from '../api/originalWorkInProgressApi'
import { wipDefaults, wipField, wipFilters, wipMeasures, wipPeriodError, wipRequest, type WipCapability,
  type WipChoice, type WipFilter, type WipMeasure, type WipResult, type WipSelection } from '../data/originalWorkInProgress'
import { wipCsv, wipExportError, wipHeaders, wipLines, wipPdf, wipUnitNote, wipValues, wipXlsx } from '../data/originalWorkInProgressExport'
import { useReportRunState } from '../hooks/useReportRunState'
const formats = ['csv', 'xlsx', 'pdf'] as const
const labels = { Подразделение: 'Підрозділи', НоменклатурнаяГруппа: 'Номенклатурні групи', СтатьяЗатрат: 'Статті витрат' }
const empty = (): WipSelection => ({ Divisions: [], ProductGroups: [], CostArticles: [] })
type Choices = Record<WipFilter, WipChoice[]>
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000) }
function retain(current: WipChoice[], previous: WipChoice[], selected: string[]) {
  const ids = new Set(current.map(c => c.Key)), kept = new Set(selected)
  return [...current, ...previous.filter(c => kept.has(c.Key) && !ids.has(c.Key))]
}
function WipTable({ result }: { result: WipResult }) {
  const { t } = useI18n(), [page, setPage] = useState(0), lines = useMemo(() => wipLines(result), [result]), headers = wipHeaders(result)
  const current = Math.min(page, Math.max(0, Math.ceil(lines.length / 50) - 1)), start = current * 50
  return <Stack gap="xs"><Group><Button variant="light" disabled={!current} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text>{lines.length ? start + 1 : 0}–{Math.min(lines.length, start + 50)} / {lines.length}</Text>
    <Button variant="light" disabled={start + 50 >= lines.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1000}><Table striped><Table.Thead><Table.Tr>{headers.map(h => <Table.Th key={h}>{t(h)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{lines.slice(start, start + 50).map(line => <Table.Tr key={line.key} fw={line.subtotal ? 600 : undefined}>
        {line.cells.map((cell, i) => <Table.Td key={headers[i]} className={i >= 3 ? 'app-money' : undefined}>{cell}</Table.Td>)}
      </Table.Tr>)}</Table.Tbody>{result.Totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={3}>{t('Разом')}</Table.Th>
        {wipValues(result, result.Totals).map((cell, i) => <Table.Td key={headers[i + 3]} className="app-money">{cell}</Table.Td>)}
      </Table.Tr></Table.Tfoot> : null}</Table></Table.ScrollContainer>{!lines.length ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}</Stack>
}
function useWipRun(capability: WipCapability, caller: string | null, allowed: boolean, from: string, through: string,
  selection: WipSelection, measures: WipMeasure[], key: string, accept: (r: WipResult) => void) {
  const run = useReportRunState<WipResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key), [exporting, setExporting] = useState(false)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const permitted = allowed && !!caller && capability.Executable, error = wipPeriodError(from, through) ?? (!measures.length ? 'Оберіть хоча б один ресурс.' : null), report = run.lastRun
  function invalidate() { latest.current = ''; active.current?.abort(); run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    active.current?.abort(); const controller = new AbortController(); active.current = controller; latest.current = key; const update = run.begin()
    try { const value = await readWip(wipRequest(capability, from, through, selection, measures), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: value }); if (value.NormalInputsComplete) accept(value)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    if (!permitted || !report?.Available || exporting || wipExportError(report)) return
    setExporting(true)
    try { const blob = format === 'csv' ? new Blob([wipCsv(report)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await wipXlsx(report) : await wipPdf(report)
      if (latest.current === key) download(blob, `wip-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, permitted, error, report, exporting, invalidate, generate, exportFile }
}
export function OriginalWorkInProgressPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: WipCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [measures, setMeasures] = useState<WipMeasure[]>([...wipDefaults])
  const callerScope = JSON.stringify([callerKey, canGenerate, capability])
  const [selection, setSelection] = useState<{ scope: string; values: WipSelection }>({ scope: '', values: empty() })
  const [choices, setChoices] = useState<{ scope: string; values: Choices; fresh: Choices } | null>(null)
  const scope = JSON.stringify([callerScope, from, through]), current = choices?.scope === scope ? choices : null
  const selected = selection.scope === scope ? selection.values : empty(), key = JSON.stringify([scope, selected, measures])
  const delivery = useWipRun(capability, callerKey, canGenerate, from, through, selected, measures, key, result => {
    const fresh = result.Choices
    setChoices(previous => ({ scope, fresh, values: Object.fromEntries(wipFilters.map(f => [f, retain(fresh[f], previous?.scope === scope ? previous.values[f] : [], selected[wipField[f]])])) as Choices }))
  })
  const busy = delivery.run.isLoading || delivery.exporting, result = delivery.report
  function choose(field: WipFilter, values: string[]) {
    delivery.invalidate(); setSelection({ scope, values: { ...selected, [wipField[field]]: values } })
    const kept = new Set(values), fresh = new Set(current?.fresh[field].map(c => c.Key) ?? [])
    setChoices(previous => previous?.scope === scope ? { ...previous, values: { ...previous.values, [field]: previous.values[field].filter(c => kept.has(c.Key) || fresh.has(c.Key)) } } : previous)
  }
  return <Stack gap="md"><Text>{t('Підрозділ → номенклатурна група → стаття витрат. Чотири суми залишків і рухів; п’ять додаткових ресурсів доступні окремо.')}</Text>
    <Group grow><TextInput type="date" label={t('Початок періоду')} value={from} disabled={busy} onChange={e => { delivery.invalidate(); setFrom(e.currentTarget.value) }} />
      <TextInput type="date" label={t('Кінець періоду (включно)')} value={through} disabled={busy} onChange={e => { delivery.invalidate(); setThrough(e.currentTarget.value) }} /></Group>
    <Group grow>{wipFilters.map(f => { const values = selected[wipField[f]], options = current?.values[f] ?? []
      return <MultiSelect key={f} label={t(labels[f])} data={options.map(c => ({ value: c.Key, label: c.Caption }))} value={values} searchable clearable maxValues={256}
        disabled={busy || (!options.length && !values.length)} onChange={v => choose(f, v)} />
    })}</Group>
    <Group>{wipMeasures.map(m => <Checkbox key={m} label={t(m)} checked={measures.includes(m)} disabled={busy} onChange={e => {
      delivery.invalidate(); const checked = e.currentTarget.checked; setMeasures(previous => wipMeasures.filter(x => x === m ? checked : previous.includes(x)))
    }} />)}</Group>
    <Text size="sm" c="dimmed">{t(wipUnitNote)}</Text>{delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <Group><Button loading={delivery.run.isLoading} disabled={!delivery.permitted || !!delivery.error || busy} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(f => <Button key={f} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!wipExportError(result)} onClick={() => { void delivery.exportFile(f) }}>{f.toUpperCase()}</Button>)}</Group>
    {result && !result.Available ? <Alert color="yellow">{t('Для повного звіту потрібні початкові залишки й усі рухи за період. Часткові суми не підставляються.')}
      {result.Dependency?.MissingMonth ? ` ${result.Dependency.MissingMonth}` : ''}</Alert> : null}
    {result?.Available ? <>{result.MissingCaptionMappings.length ? <Text>{t('Частина назв і відборів недоступна; всі ключі та суми збережено окремо.')}</Text> : null}
      <WipTable key={result.ResultSha256} result={result} /></> : null}
  </Stack>
}
