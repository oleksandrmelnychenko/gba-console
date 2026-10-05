import { Alert, Button, Group, MultiSelect, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readAmgDiscountAnalysis } from '../api/originalAmgDiscountAnalysisApi'
import { amgDiscountAnalysisDateError, amgDiscountAnalysisRequest, type AmgDiscountAnalysisCapability, type AmgDiscountAnalysisResult } from '../data/originalAmgDiscountAnalysis'
import { amgDiscountAnalysisCsv, amgDiscountAnalysisExportError, amgDiscountAnalysisPdf, amgDiscountAnalysisXlsx } from '../data/originalAmgDiscountAnalysisExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalAmgDiscountAnalysisGrid } from './OriginalAmgDiscountAnalysisGrid'
const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function useAmgDiscountAnalysisRun(key: string, permitted: boolean, through: string) {
  const run = useReportRunState<AmgDiscountAnalysisResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), activeExport = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort(); activeExport.current?.abort() } }, [key])
  function invalidate() { active.current?.abort(); activeExport.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || amgDiscountAnalysisDateError(through) || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller; latest.current = key; const update = run.begin()
    try { const result = await readAmgDiscountAnalysis(amgDiscountAnalysisRequest(through), controller.signal); if (!controller.signal.aborted) update({ lastRun: result }) }
    catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт AMG.' }) }
    finally { if (!controller.signal.aborted) update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.Available || exporting || amgDiscountAnalysisExportError(result)) return
    const controller = new AbortController(); activeExport.current?.abort(); activeExport.current = controller; setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([amgDiscountAnalysisCsv(result)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await amgDiscountAnalysisXlsx(result) : await amgDiscountAnalysisPdf(result)
      if (!controller.signal.aborted && latest.current === key) download(blob, `amg-discount-analysis-${result.Through}.${format}`)
    } catch (failure) { if (!controller.signal.aborted && latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл AMG.' }) }
    finally { setExporting(false) }
  }
  return { run, exporting, invalidate, generate, exportFile }
}
function AmgDiscountAnalysisActions({ delivery, permitted, dateError }: { delivery: ReturnType<typeof useAmgDiscountAnalysisRun>; permitted: boolean; dateError: string | null }) {
  const { t } = useI18n(), result = delivery.run.lastRun, busy = delivery.run.isLoading || delivery.exporting
  const exportError = useMemo(() => result?.Available ? amgDiscountAnalysisExportError(result) : null, [result])
  return <Stack gap="xs"><Button disabled={!permitted || !!dateError || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
    <Group aria-label={t('Експорт завершеного звіту AMG')}>{formats.map(format => <Button key={format} variant="light" disabled={!permitted || !result?.Available || busy || !!exportError} onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}</Stack>
}
function AmgDiscountAnalysisOutcome({ result }: { result: AmgDiscountAnalysisResult | null }) {
  const { t } = useI18n()
  if (!result) return null
  if (!result.NormalInputsComplete) return <Alert color="yellow">{t('Повні узгоджені звичайні дані AMG для цієї дати ще недоступні. Оновіть дані й повторіть формування.')}</Alert>
  return <Stack gap="xs">{!result.Available ? <Alert color="yellow">{t('Частина назв або ресурсів AMG недоступна. Їх позначено в таблиці; експорт очікує повних даних.')}</Alert> : null}
    <OriginalAmgDiscountAnalysisGrid key={result.ResultSha256} result={result} /></Stack>
}
export function OriginalAmgDiscountAnalysisPanel({ capability, callerKey, canGenerate, initialThrough }: {
  capability: AmgDiscountAnalysisCapability; callerKey: string | null; canGenerate: boolean; initialThrough: string
}) {
  const { t } = useI18n(), [through, setThrough] = useState(initialThrough)
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'amg'
  const key = JSON.stringify([callerKey, canGenerate, capability, through])
  const delivery = useAmgDiscountAnalysisRun(key, permitted, through), dateError = amgDiscountAnalysisDateError(through)
  const busy = delivery.run.isLoading || delivery.exporting
  return <Stack gap="md"><Text>{t('AMG · Аналіз знижок і націнок: контрагенти в рядках, номенклатура у стовпцях; тип ціни й відсоток. Загальних підсумків немає.')}</Text>
    <TextInput type="date" label={t('Дата зрізу')} value={through} disabled={busy} onChange={event => { delivery.invalidate(); setThrough(event.currentTarget.value) }} />
    <MultiSelect label={t('Контрагенти')} data={[]} value={[]} disabled placeholder={t('Назви для відбору ще недоступні')} />
    <MultiSelect label={t('Номенклатура')} data={[]} value={[]} disabled placeholder={t('Назви для відбору ще недоступні')} />
    <Text size="sm" c="dimmed">{t('Відбори за назвами для цієї форми AMG ще недоступні. Формування охоплює всіх контрагентів і всю номенклатуру.')}</Text>
    <Text size="sm" c="dimmed">{t('Звіт показує стан на кінець обраного дня. Поточні дані перевіряються під час формування.')}</Text>
    {dateError ? <Alert color="yellow">{t(dateError)}</Alert> : null}{delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <AmgDiscountAnalysisActions delivery={delivery} permitted={permitted} dateError={dateError} /><AmgDiscountAnalysisOutcome result={delivery.run.lastRun} /></Stack>
}
