import { Alert, Button, Group, MultiSelect, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readDefectCost } from '../api/originalDefectCostApi'
import { defectCostDefaultMeasures, defectCostLabels, defectCostMeasures, defectCostPeriodError, defectCostRequest, type DefectCostCapability, type DefectCostMeasure, type DefectCostResult } from '../data/originalDefectCost'
import { defectCostCsv, defectCostExportError, defectCostHeaders, defectCostLines, defectCostPdf, defectCostValues, defectCostXlsx } from '../data/originalDefectCostExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalSalesGrid } from './OriginalSalesGrid'
import { OriginalPeriodDateInputs } from './WarehousePeriodControls'

const formats = ['csv', 'xlsx', 'pdf'] as const
const dependencies: Record<string, string> = {
  normal_storage_unavailable: 'Дані для звіту ще недоступні.',
  opening_publication_unavailable: 'Повний початковий залишок для цього періоду ще недоступний.',
  month_publication_unavailable: 'Не всі місячні рухи цього періоду синхронізовані повністю.',
  raw_visibility_unavailable: 'Повні дані цього періоду ще недоступні.',
  normal_journal_invalid: 'Повні узгоджені дані цього періоду недоступні.',
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function useDefectCostRun(capability: DefectCostCapability, callerKey: string | null, canGenerate: boolean,
  from: string, through: string, measures: DefectCostMeasure[], key: string) {
  const run = useReportRunState<DefectCostResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), activeExport = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort(); activeExport.current?.abort() } }, [key])
  const error = defectCostPeriodError(from, through) ?? (!measures.length ? 'Виберіть хоча б один показник.' : null)
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  function invalidate() { active.current?.abort(); activeExport.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const result = await readDefectCost(defectCostRequest(capability, from, through, [], [], measures), controller.signal)
      if (!controller.signal.aborted) update({ lastRun: result })
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.Available || exporting || defectCostExportError(result)) return
    const controller = new AbortController(); activeExport.current?.abort(); activeExport.current = controller
    setExporting(true)
    try {
      const file = format === 'csv' ? new Blob([defectCostCsv(result)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await defectCostXlsx(result) : await defectCostPdf(result)
      if (!controller.signal.aborted && latest.current === key) download(file, `defect-cost-${result.From}-${result.Through}.${format}`)
    } catch (failure) { if (!controller.signal.aborted && latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, error, permitted, exporting, invalidate, generate, exportFile }
}
function DefectCostResultView({ result }: { result: DefectCostResult | null }) {
  const { t } = useI18n()
  const lines = useMemo(() => result?.Available ? defectCostLines(result) : [], [result])
  if (!result) return null
  if (!result.Available) return <Alert color="yellow">{t(dependencies[result.Dependency?.Kind ?? ''] ?? 'Повні дані цього періоду ще недоступні. Частковий звіт не формується.')}
    {result.Dependency?.MissingMonth ? ` ${t('Місяць')}: ${result.Dependency.MissingMonth.slice(0, 7)}.` : ''}</Alert>
  return <OriginalSalesGrid key={result.ResultSha256} lines={lines} headers={defectCostHeaders(result)} totals={result.Totals ? defectCostValues(result.Totals, result) : null} />
}
export function OriginalDefectCostPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: DefectCostCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [measures, setMeasures] = useState<DefectCostMeasure[]>([...defectCostDefaultMeasures])
  const key = JSON.stringify([callerKey, canGenerate, capability, from, through, measures])
  const delivery = useDefectCostRun(capability, callerKey, canGenerate, from, through, measures, key)
  const result = delivery.run.lastRun, busy = delivery.run.isLoading || delivery.exporting
  const exportError = result?.Available ? defectCostExportError(result) : null
  return <Stack gap="md">
    <Text size="sm">{t('Вартість браку за вибраний період: підрозділ → стаття витрат. Суми управлінського обліку без валютного перерахунку.')}</Text>
    <OriginalPeriodDateInputs from={from} through={through} busy={busy}
      changeFrom={value => { delivery.invalidate(); setFrom(value) }} changeThrough={value => { delivery.invalidate(); setThrough(value) }} />
    <MultiSelect label={t('Показники')} value={measures} data={defectCostMeasures.map(value => ({ value, label: t(defectCostLabels[value]) }))} maxValues={8} disabled={busy}
      onChange={value => { const selected = new Set(value); delivery.invalidate(); setMeasures(defectCostMeasures.filter(m => selected.has(m))) }} />
    <Group grow><MultiSelect label={t('Підрозділи')} placeholder={t('Назви підрозділів ще недоступні')} data={[]} value={[]} disabled />
      <MultiSelect label={t('Статті витрат')} placeholder={t('Назви статей витрат ще недоступні')} data={[]} value={[]} disabled /></Group>
    <Text size="sm" c="dimmed">{t('Відбір за підрозділом і статтею витрат стане доступним після завантаження їхніх назв. Зараз формування виконується без цих відборів.')}</Text>
    <Text size="sm" c="dimmed">{t('Період охоплює календарні дні до 23:59:59. Повна відповідність датам і підсумкам оригіналу 1С ще не підтверджена.')}</Text>
    {delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    <Group><Button disabled={!delivery.permitted || !!delivery.error || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(format => <Button key={format} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!exportError}
        onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    <DefectCostResultView result={result} />
  </Stack>
}
