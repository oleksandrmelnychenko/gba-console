import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readFenixDiscountAnalysis } from '../api/originalFenixDiscountAnalysisApi'
import { fenixDiscountDateError, type FenixDiscountCapability, type FenixDiscountResult } from '../data/originalFenixDiscountAnalysis'
import { emptyFenixDiscountSelection, selectedFenixDiscountRequest, type FenixDiscountChoices, type FenixDiscountField, type FenixDiscountSelection } from '../data/originalFenixDiscountAnalysisChoices'
import { fenixDiscountCsv, fenixDiscountExportError, fenixDiscountPdf, fenixDiscountXlsx } from '../data/originalFenixDiscountAnalysisExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { useFenixDiscountChoices } from '../hooks/useFenixDiscountChoices'
import { OriginalFenixDiscountChoiceControls } from './OriginalFenixDiscountChoiceControls'
import { OriginalFenixDiscountAnalysisGrid } from './OriginalFenixDiscountAnalysisGrid'
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
    if (!permitted || fenixDiscountDateError(through) || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; latest.current = key; const update = run.begin()
    try { const result = await readFenixDiscountAnalysis(selectedFenixDiscountRequest(through, selection, names), controller.signal); if (!controller.signal.aborted) update({ lastRun: result }) }
    catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.Available || exporting || fenixDiscountExportError(result)) return
    const controller = new AbortController(); activeExport.current?.abort(); activeExport.current = controller; setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([fenixDiscountCsv(result)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await fenixDiscountXlsx(result) : await fenixDiscountPdf(result)
      if (!controller.signal.aborted && latest.current === key) download(blob, `fenix-discount-analysis-${result.Through}.${format}`)
    } catch (failure) { if (!controller.signal.aborted && latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, exporting, invalidate, generate, exportFile }
}
function FenixDiscountActions({ delivery, permitted, dateError }: { delivery: ReturnType<typeof useFenixDiscountRun>; permitted: boolean; dateError: string | null }) {
  const { t } = useI18n(), result = delivery.run.lastRun, busy = delivery.run.isLoading || delivery.exporting
  const exportError = useMemo(() => result?.Available ? fenixDiscountExportError(result) : null, [result])
  return <><Group><Button disabled={!permitted || !!dateError || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
    {formats.map(format => <Button key={format} variant="light" disabled={!permitted || !result?.Available || busy || !!exportError} onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}</>
}
function FenixDiscountOutcome({ result }: { result: FenixDiscountResult | null }) {
  const { t } = useI18n()
  if (!result) return null
  if (!result.NormalInputsComplete) return <Alert color="yellow">{t('Повні узгоджені звичайні дані для цієї дати ще недоступні. Оновіть дані й повторіть формування.')}</Alert>
  return <>{!result.Available ? <Alert color="yellow">{t('Частина назв або ресурсів недоступна. Їх позначено в таблиці; експорт буде доступний після оновлення даних.')}</Alert> : null}
    <OriginalFenixDiscountAnalysisGrid key={result.ResultSha256} result={result} /></>
}
function FenixDiscountMessages({ dateError, runError, ready }: { dateError: string | null; runError: string | null; ready: boolean | undefined }) {
  const { t } = useI18n()
  return <>{ready === false ? <Text size="sm" c="dimmed">{t('Дані звіту ще не повні. Доступні назви можна переглянути; для формування потрібне оновлення даних.')}</Text> : null}
    {dateError ? <Alert color="yellow">{t(dateError)}</Alert> : null}{runError ? <Alert color="red">{t(runError)}</Alert> : null}</>
}
export function OriginalFenixDiscountAnalysisPanel({ capability, callerKey, canGenerate, initialThrough }: {
  capability: FenixDiscountCapability; callerKey: string | null; canGenerate: boolean; initialThrough: string
}) {
  const { t } = useI18n(), [through, setThrough] = useState(initialThrough)
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  const names = useFenixDiscountChoices(through, permitted, callerKey), named = names.run.lastRun?.names ?? null
  const [selection, setSelection] = useState<{ key: string; witness: string | null; values: FenixDiscountSelection }>({ key: '', witness: null, values: emptyFenixDiscountSelection() })
  const selected = named && selection.key === names.key && selection.witness === named.ResultSha256 ? selection.values : emptyFenixDiscountSelection()
  const key = JSON.stringify([callerKey, canGenerate, capability, through, selected, named?.ChoicesWitnessSha256 ?? null, named?.ResultSha256 ?? null])
  const delivery = useFenixDiscountRun(key, permitted, through, selected, named), dateError = fenixDiscountDateError(through)
  const busy = delivery.run.isLoading || delivery.exporting || names.run.isLoading
  function select(field: FenixDiscountField, values: string[]) { delivery.invalidate(); setSelection({ key: names.key, witness: named?.ResultSha256 ?? null, values: { ...selected, [field]: [...values] } }) }
  return <Stack gap="md"><Text>{t('Fenix · Аналіз знижок і націнок: контрагенти в рядках, номенклатура у стовпцях; тип ціни й відсоток. Загальних підсумків немає.')}</Text>
    <TextInput type="date" label={t('Дата зрізу')} value={through} disabled={busy} onChange={event => { delivery.invalidate(); setThrough(event.currentTarget.value) }} />
    <OriginalFenixDiscountChoiceControls names={named} selection={selected} busy={busy} permitted={permitted} dateError={dateError} error={names.run.error} loading={names.run.isLoading}
      onSelect={select} onLoad={() => { delivery.invalidate(); setSelection({ key: '', witness: null, values: emptyFenixDiscountSelection() }); void names.load() }} />
    <Text size="sm" c="dimmed">{t('Звіт показує стан на кінець обраного дня. Залиште відбори порожніми, щоб охопити всіх контрагентів і всю номенклатуру.')}</Text>
    <FenixDiscountMessages ready={names.run.lastRun?.readiness.Executable} dateError={dateError} runError={delivery.run.error} />
    <FenixDiscountActions delivery={delivery} permitted={permitted && !names.run.isLoading} dateError={dateError} /><FenixDiscountOutcome result={delivery.run.lastRun} /></Stack>
}
