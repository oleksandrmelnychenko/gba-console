import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readFenixDiscounts } from '../api/originalFenixClientDiscountsApi'
import { fenixDateError, emptyFenixSelection, selectedFenixRequest, type FenixDiscountChoices, type FenixDiscountField, type FenixDiscountReadiness, type FenixDiscountResult, type FenixDiscountSelection } from '../data/originalFenixClientDiscounts'
import { fenixDiscountCsv, fenixDiscountExportError, fenixDiscountHeaders, fenixDiscountLines, fenixDiscountPdf, fenixDiscountXlsx } from '../data/originalFenixClientDiscountsExport'
import { useFenixClientDiscountChoices } from '../hooks/useFenixClientDiscountChoices'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalFenixClientDiscountChoiceControls } from './OriginalFenixClientDiscountChoiceControls'
import { OriginalSalesGrid } from './OriginalSalesGrid'
const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function useFenixDiscountRun(key: string, permitted: boolean, through: string, selection: FenixDiscountSelection, names: FenixDiscountChoices | null) {
  const run = useReportRunState<FenixDiscountResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), activeExport = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort(); activeExport.current?.abort() } }, [key])
  function invalidate() { active.current?.abort(); activeExport.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || fenixDateError(through) || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; latest.current = key; const update = run.begin()
    try { const result = await readFenixDiscounts(selectedFenixRequest(through, selection, names), controller.signal); if (!controller.signal.aborted) update({ lastRun: result }) }
    catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.InputAvailable || exporting || fenixDiscountExportError(result)) return
    const controller = new AbortController(); activeExport.current?.abort(); activeExport.current = controller; setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([fenixDiscountCsv(result)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await fenixDiscountXlsx(result) : await fenixDiscountPdf(result)
      if (!controller.signal.aborted && latest.current === key) download(blob, `fenix-discounts-${result.Through}.${format}`)
    } catch (failure) { if (!controller.signal.aborted && latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, exporting, invalidate, generate, exportFile }
}
function FenixDiscountResultView({ result }: { result: FenixDiscountResult | null }) {
  const { t } = useI18n(), lines = useMemo(() => result?.InputAvailable ? fenixDiscountLines(result) : [], [result])
  if (!result) return null
  if (!result.InputAvailable) return <Alert color="yellow">{t('Повні узгоджені дані для цього зрізу ще недоступні. Частковий звіт не формується.')}</Alert>
  return <Stack gap="xs">{result.MaximumPercentage !== null ? <Text>{t('Максимальний відсоток')}: {result.MaximumPercentage}</Text> : null}
    <OriginalSalesGrid key={result.ResultSha256} hierarchyColumns={3} lines={lines} headers={fenixDiscountHeaders} totals={null} /></Stack>
}
function FenixDiscountMessages({ dateError, runError, exportError }: {
  dateError: string | null; runError: string | null; exportError: string | null
}) {
  const { t } = useI18n()
  return <>{dateError ? <Alert color="yellow">{t(dateError)}</Alert> : null}{runError ? <Alert color="red">{t(runError)}</Alert> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}</>
}
function FenixDiscountActions({ delivery, permitted, dateError, busy, exportError }: {
  delivery: ReturnType<typeof useFenixDiscountRun>; permitted: boolean; dateError: string | null; busy: boolean; exportError: string | null
}) {
  const { t } = useI18n(), result = delivery.run.lastRun
  return <Group><Button disabled={!permitted || !!dateError || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
    {formats.map(format => <Button key={format} variant="light" disabled={!permitted || !result?.InputAvailable || busy || !!exportError} onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
}
export function OriginalFenixClientDiscountsPanel({ readiness, callerKey, canGenerate, initialThrough }: {
  readiness: FenixDiscountReadiness; callerKey: string | null; canGenerate: boolean; initialThrough: string
}) {
  const { t } = useI18n(), [through, setThrough] = useState(initialThrough)
  const permitted = canGenerate && !!callerKey && readiness.Executable && readiness.World === 'fenix', dateError = fenixDateError(through)
  const names = useFenixClientDiscountChoices(through, permitted, callerKey), named = names.run.lastRun
  const [selection, setSelection] = useState<{ scope: ReturnType<typeof useFenixClientDiscountChoices>['scope'] | null; witness: string | null; values: FenixDiscountSelection }>({ scope: null, witness: null, values: emptyFenixSelection() })
  const selected = named && selection.scope === names.scope && selection.witness === named.ResultSha256 ? selection.values : emptyFenixSelection()
  const key = JSON.stringify([callerKey, canGenerate, readiness, through, selected, named?.ChoicesWitnessSha256 ?? null])
  const delivery = useFenixDiscountRun(key, permitted, through, selected, named), result = delivery.run.lastRun
  const busy = delivery.run.isLoading || delivery.exporting || names.run.isLoading, exportError = result?.InputAvailable ? fenixDiscountExportError(result) : null
  function select(field: FenixDiscountField, values: string[]) { delivery.invalidate(); setSelection({ scope: names.scope, witness: named?.ResultSha256 ?? null, values: { ...selected, [field]: [...values] } }) }
  return <Stack gap="md"><Text size="sm">{t('FENIX · ОтчетПоСкидкам: отримувач → номенклатура, максимальний відсоток знижки/націнки. Прямий код регіону належить отримувачу.')}</Text>
    <Text size="sm" c="dimmed">{t('Форма підтримує прямі знижки клієнтів з числовим відсотком. Інші типи отримувачів або відсотка залишають повний результат недоступним.')}</Text>
    <TextInput type="date" label={t('Дата зрізу')} value={through} disabled={busy} onChange={event => { delivery.invalidate(); setThrough(event.currentTarget.value) }} />
    <OriginalFenixClientDiscountChoiceControls names={named} selection={selected} busy={busy} permitted={permitted} dateError={dateError} error={names.run.error} loading={names.run.isLoading}
      onSelect={select} onLoad={() => { delivery.invalidate(); setSelection({ scope: null, witness: null, values: emptyFenixSelection() }); void names.load() }} />
    <Text size="sm" c="dimmed">{t('Зріз охоплює останню цілу секунду дня, 23:59:59. Відсотки не додаються. Відповідність поточному оригіналу 1С ще не підтверджена; валютна конвертація не застосовується.')}</Text>
    <FenixDiscountMessages dateError={dateError} runError={delivery.run.error} exportError={exportError} />
    <FenixDiscountActions delivery={delivery} permitted={permitted} dateError={dateError} busy={busy} exportError={exportError} />
    <FenixDiscountResultView result={result} /></Stack>
}
