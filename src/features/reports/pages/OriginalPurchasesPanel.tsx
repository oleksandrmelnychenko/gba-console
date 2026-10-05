import { Alert, Button, Group, MultiSelect, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readPurchases } from '../api/originalPurchasesApi'
import { purchasesDefaultMeasures, purchasesFilterLabels, purchasesFilters, purchasesLabels, purchasesMeasures, purchasesPeriodError, purchasesRequest, type PurchasesCapability, type PurchasesMeasure, type PurchasesResult } from '../data/originalPurchases'
import { purchasesCsv, purchasesExportError, purchasesHeaders, purchasesLines, purchasesPdf, purchasesValues, purchasesXlsx } from '../data/originalPurchasesExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalSalesGrid } from './OriginalSalesGrid'
import { OriginalPeriodDateInputs } from './WarehousePeriodControls'

const formats = ['csv', 'xlsx', 'pdf'] as const
const dependencies: Record<string, string> = {
  normal_storage_unavailable: 'Дані для звіту ще недоступні.', normal_month_vector_unavailable: 'Не всі місяці вибраного періоду доступні повністю.',
  normal_month_incomplete: 'Не всі місячні рухи цього періоду синхронізовані повністю.',
  normal_source_identity_unavailable: 'Узгоджені дані цього періоду ще недоступні.', normal_source_identity_conflict: 'Узгоджені дані цього періоду ще недоступні.',
  normal_journal_invalid: 'Повні узгоджені дані цього періоду недоступні.', raw_activity_unavailable: 'Повні дані активності цього періоду ще недоступні.',
  product_units_publication_unavailable: 'Дані одиниць номенклатури цього періоду ще недоступні.',
  storage_unit_coefficient_unavailable: 'Повні коефіцієнти базових одиниць ще недоступні.', report_unit_coefficient_unavailable: 'Повні коефіцієнти звітних одиниць ще недоступні.',
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function usePurchasesRun(capability: PurchasesCapability, callerKey: string | null, canGenerate: boolean,
  from: string, through: string, measures: PurchasesMeasure[], key: string) {
  const run = useReportRunState<PurchasesResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), activeExport = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort(); activeExport.current?.abort() } }, [key])
  const error = purchasesPeriodError(from, through) ?? (!measures.length ? 'Виберіть хоча б один показник.' : null)
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  function invalidate() { active.current?.abort(); activeExport.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const result = await readPurchases(purchasesRequest(capability, from, through, measures), controller.signal)
      if (!controller.signal.aborted) update({ lastRun: result })
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати звіт.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.Available || exporting || purchasesExportError(result)) return
    const controller = new AbortController(); activeExport.current?.abort(); activeExport.current = controller; setExporting(true)
    try {
      const file = format === 'csv' ? new Blob([purchasesCsv(result)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await purchasesXlsx(result) : await purchasesPdf(result)
      if (!controller.signal.aborted && latest.current === key) download(file, `purchases-${result.From}-${result.Through}.${format}`)
    } catch (failure) { if (!controller.signal.aborted && latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, error, permitted, exporting, invalidate, generate, exportFile }
}
function PurchasesResultView({ result }: { result: PurchasesResult | null }) {
  const { t } = useI18n(), lines = useMemo(() => result?.Available ? purchasesLines(result) : [], [result])
  if (!result) return null
  if (!result.Available) return <Alert color="yellow">{t(dependencies[result.Dependency?.Kind ?? ''] ?? 'Повні дані цього періоду ще недоступні. Частковий звіт не формується.')}
    {result.Dependency?.MissingMonth ? ` ${t('Місяць')}: ${result.Dependency.MissingMonth}.` : ''}</Alert>
  return <OriginalSalesGrid key={result.ResultSha256} hierarchyColumns={3} lines={lines} headers={purchasesHeaders(result)} totals={result.Totals ? purchasesValues(result.Totals, result) : null} />
}
function PurchasesUnavailableFilters() {
  const { t } = useI18n()
  return <>
    <Group grow>{purchasesFilters.map(field => <MultiSelect key={field} label={t(purchasesFilterLabels[field])} data={[]} value={[]} disabled
      placeholder={t('Назви ще недоступні')} />)}</Group>
    <Text size="sm" c="dimmed">{t('Відбори стануть доступними після завантаження назв. Зараз звіт формується без відборів за всіма п’ятьма полями.')}</Text>
  </>
}
export function OriginalPurchasesPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: PurchasesCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [measures, setMeasures] = useState<PurchasesMeasure[]>([...purchasesDefaultMeasures])
  const key = JSON.stringify([callerKey, canGenerate, capability, from, through, measures])
  const delivery = usePurchasesRun(capability, callerKey, canGenerate, from, through, measures, key)
  const result = delivery.run.lastRun, busy = delivery.run.isLoading || delivery.exporting, exportError = result?.Available ? purchasesExportError(result) : null
  return <Stack gap="md">
    <Text size="sm">{t('Закупки за період: статус партії → контрагент → номенклатура. За замовчуванням — кількість у базових одиницях.')}</Text>
    <OriginalPeriodDateInputs from={from} through={through} busy={busy}
      changeFrom={value => { delivery.invalidate(); setFrom(value) }} changeThrough={value => { delivery.invalidate(); setThrough(value) }} />
    <MultiSelect label={t('Показники')} value={measures} data={purchasesMeasures.map(value => ({ value, label: t(purchasesLabels[value]) }))} maxValues={3} disabled={busy}
      onChange={value => { const selected = new Set(value); delivery.invalidate(); setMeasures(purchasesMeasures.filter(m => selected.has(m))) }} />
    <PurchasesUnavailableFilters />
    <Text size="sm" c="dimmed">{t('Кількості мають три десяткові знаки. Період охоплює календарні дні до 23:59:59. Повна відповідність підсумкам оригіналу 1С ще не підтверджена.')}</Text>
    {delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    <Group><Button disabled={!delivery.permitted || !!delivery.error || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(format => <Button key={format} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!exportError}
        onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    <PurchasesResultView result={result} />
  </Stack>
}
