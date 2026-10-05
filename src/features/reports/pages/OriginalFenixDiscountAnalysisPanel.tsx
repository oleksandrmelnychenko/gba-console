import { Alert, Button, Group, MultiSelect, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readFenixDiscountAnalysis } from '../api/originalFenixDiscountAnalysisApi'
import { fenixDiscountDateError, fenixDiscountRequest, type FenixDiscountCapability, type FenixDiscountResult } from '../data/originalFenixDiscountAnalysis'
import { fenixDiscountCsv, fenixDiscountExportError, fenixDiscountPdf, fenixDiscountXlsx } from '../data/originalFenixDiscountAnalysisExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalFenixDiscountAnalysisGrid } from './OriginalFenixDiscountAnalysisGrid'
const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function useFenixDiscountRun(key: string, permitted: boolean, through: string) {
  const run = useReportRunState<FenixDiscountResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), activeExport = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort(); activeExport.current?.abort() } }, [key])
  function invalidate() { active.current?.abort(); activeExport.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || fenixDiscountDateError(through) || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; latest.current = key; const update = run.begin()
    try { const result = await readFenixDiscountAnalysis(fenixDiscountRequest(through), controller.signal); if (!controller.signal.aborted) update({ lastRun: result }) }
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
  if (!result.NormalInputsComplete) return <Alert color="yellow">{t('Повні узгоджені звичайні дані Fenix ще недоступні. Порожній або частковий результат не підставляється.')}</Alert>
  return <>{!result.Available ? <Alert color="yellow">{t('Частина назв або ресурсів недоступна: порядок кількох посилань не підтверджений. Значення не замінюються нулем; експорт повного звіту недоступний.')}</Alert> : null}
    <OriginalFenixDiscountAnalysisGrid key={result.ResultSha256} result={result} /></>
}
export function OriginalFenixDiscountAnalysisPanel({ capability, callerKey, canGenerate, initialThrough }: {
  capability: FenixDiscountCapability; callerKey: string | null; canGenerate: boolean; initialThrough: string
}) {
  const { t } = useI18n(), [through, setThrough] = useState(initialThrough)
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  const key = JSON.stringify([callerKey, canGenerate, capability, through]), delivery = useFenixDiscountRun(key, permitted, through), dateError = fenixDiscountDateError(through)
  return <Stack gap="md"><Text>{t('Fenix · Аналіз знижок і націнок: контрагенти в рядках, номенклатура у стовпцях; тип ціни й відсоток. Загальних підсумків немає.')}</Text>
    <TextInput type="date" label={t('Дата зрізу')} value={through} disabled={delivery.run.isLoading || delivery.exporting} onChange={event => { delivery.invalidate(); setThrough(event.currentTarget.value) }} />
    <Group grow><MultiSelect label={t('Контрагенти')} data={[]} value={[]} disabled description={t('Підтверджені назви для відбору ще недоступні.')} />
      <MultiSelect label={t('Номенклатура')} data={[]} value={[]} disabled description={t('Підтверджені назви для відбору ще недоступні.')} /></Group>
    <Text size="sm" c="dimmed">{t('Запит без відборів використовує звичайні дані GBA й останню цілу секунду дня, 23:59:59. Виконуваний API не підтверджує наявність поточних даних. Відповідність оригіналу 1С, його порядку посилань та дат ще не перевірена. Відсотки не додаються; валютна конвертація не застосовується.')}</Text>
    {dateError ? <Alert color="yellow">{t(dateError)}</Alert> : null}{delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <FenixDiscountActions delivery={delivery} permitted={permitted} dateError={dateError} /><FenixDiscountOutcome result={delivery.run.lastRun} /></Stack>
}
