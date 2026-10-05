import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readAmgDiscounts } from '../api/originalAmgClientDiscountsApi'
import { amgDateError, emptyAmgSelection, selectedAmgRequest, type AmgDiscountChoices, type AmgDiscountField, type AmgDiscountReadiness, type AmgDiscountResult, type AmgDiscountSelection } from '../data/originalAmgClientDiscounts'
import { amgDiscountCsv, amgDiscountExportError, amgDiscountHeaders, amgDiscountLines, amgDiscountPdf, amgDiscountXlsx } from '../data/originalAmgClientDiscountsExport'
import { useAmgDiscountChoices } from '../hooks/useAmgDiscountChoices'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalAmgDiscountChoiceControls } from './OriginalAmgDiscountChoiceControls'
import { OriginalSalesGrid } from './OriginalSalesGrid'
const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function useAmgDiscountRun(key: string, permitted: boolean, through: string, selection: AmgDiscountSelection, names: AmgDiscountChoices | null) {
  const run = useReportRunState<AmgDiscountResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), activeExport = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort(); activeExport.current?.abort() } }, [key])
  function invalidate() { active.current?.abort(); activeExport.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || amgDateError(through) || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; latest.current = key; const update = run.begin()
    try { const result = await readAmgDiscounts(selectedAmgRequest(through, selection, names), controller.signal); if (!controller.signal.aborted) update({ lastRun: result }) }
    catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.InputAvailable || exporting || amgDiscountExportError(result)) return
    const controller = new AbortController(); activeExport.current?.abort(); activeExport.current = controller; setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([amgDiscountCsv(result)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await amgDiscountXlsx(result) : await amgDiscountPdf(result)
      if (!controller.signal.aborted && latest.current === key) download(blob, `amg-discounts-${result.Through}.${format}`)
    } catch (failure) { if (!controller.signal.aborted && latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, exporting, invalidate, generate, exportFile }
}
function AmgDiscountResultView({ result }: { result: AmgDiscountResult | null }) {
  const { t } = useI18n(), lines = useMemo(() => result?.InputAvailable ? amgDiscountLines(result) : [], [result])
  if (!result) return null
  if (!result.InputAvailable) return <Alert color="yellow">{t('Повні узгоджені дані для цього зрізу ще недоступні. Частковий звіт не формується.')}</Alert>
  return <Stack gap="xs">{result.MaximumPercentage !== null ? <Text>{t('Максимальний відсоток')}: {result.MaximumPercentage}</Text> : null}
    <OriginalSalesGrid key={result.ResultSha256} hierarchyColumns={3} lines={lines} headers={amgDiscountHeaders} totals={null} /></Stack>
}
function AmgDiscountMessages({ dateError, runError, exportError }: {
  dateError: string | null; runError: string | null; exportError: string | null
}) {
  const { t } = useI18n()
  return <>{dateError ? <Alert color="yellow">{t(dateError)}</Alert> : null}{runError ? <Alert color="red">{t(runError)}</Alert> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}</>
}
function AmgDiscountActions({ delivery, permitted, dateError, busy, exportError }: {
  delivery: ReturnType<typeof useAmgDiscountRun>; permitted: boolean; dateError: string | null; busy: boolean; exportError: string | null
}) {
  const { t } = useI18n(), result = delivery.run.lastRun
  return <Group><Button disabled={!permitted || !!dateError || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
    {formats.map(format => <Button key={format} variant="light" disabled={!permitted || !result?.InputAvailable || busy || !!exportError} onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
}
export function OriginalAmgClientDiscountsPanel({ readiness, callerKey, canGenerate, initialThrough }: {
  readiness: AmgDiscountReadiness; callerKey: string | null; canGenerate: boolean; initialThrough: string
}) {
  const { t } = useI18n(), [through, setThrough] = useState(initialThrough)
  const permitted = canGenerate && !!callerKey && readiness.Executable && readiness.World === 'amg', dateError = amgDateError(through)
  const names = useAmgDiscountChoices(through, permitted, callerKey), named = names.run.lastRun
  const [selection, setSelection] = useState<{ key: string; witness: string | null; values: AmgDiscountSelection }>({ key: '', witness: null, values: emptyAmgSelection() })
  const selected = named && selection.key === names.key && selection.witness === named.ResultSha256 ? selection.values : emptyAmgSelection()
  const key = JSON.stringify([callerKey, canGenerate, readiness, through, selected, named?.ChoicesWitnessSha256 ?? null])
  const delivery = useAmgDiscountRun(key, permitted, through, selected, named), result = delivery.run.lastRun
  const busy = delivery.run.isLoading || delivery.exporting || names.run.isLoading, exportError = result?.InputAvailable ? amgDiscountExportError(result) : null
  function select(field: AmgDiscountField, values: string[]) { delivery.invalidate(); setSelection({ key: names.key, witness: named?.ResultSha256 ?? null, values: { ...selected, [field]: [...values] } }) }
  return <Stack gap="md"><Text size="sm">{t('AMG · ОтчетПоСкидкам: отримувач → номенклатура, максимальний відсоток знижки/націнки. Прямий код регіону належить отримувачу.')}</Text>
    <TextInput type="date" label={t('Дата зрізу')} value={through} disabled={busy} onChange={event => { delivery.invalidate(); setThrough(event.currentTarget.value) }} />
    <OriginalAmgDiscountChoiceControls names={named} selection={selected} busy={busy} permitted={permitted} dateError={dateError} error={names.run.error} loading={names.run.isLoading}
      onSelect={select} onLoad={() => { delivery.invalidate(); setSelection({ key: '', witness: null, values: emptyAmgSelection() }); void names.load() }} />
    <Text size="sm" c="dimmed">{t('Зріз охоплює останню цілу секунду дня, 23:59:59. Відсотки не додаються. Відповідність поточному оригіналу 1С ще не підтверджена; валютна конвертація не застосовується.')}</Text>
    <AmgDiscountMessages dateError={dateError} runError={delivery.run.error} exportError={exportError} />
    <AmgDiscountActions delivery={delivery} permitted={permitted} dateError={dateError} busy={busy} exportError={exportError} />
    <AmgDiscountResultView result={result} /></Stack>
}
