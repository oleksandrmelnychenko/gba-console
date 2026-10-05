import { Alert, Button, Group, MultiSelect, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readPurchases } from '../api/originalPurchasesApi'
import { purchasesDefaultMeasures, purchasesLabels, purchasesMeasures, purchasesPeriodError, purchasesRequest, type PurchasesCapability, type PurchasesField, type PurchasesMeasure, type PurchasesResult } from '../data/originalPurchases'
import { emptyPurchasesSelections, purchasesNamedRequest, type PurchasesChoices, type PurchasesSelections } from '../data/originalPurchasesChoices'
import { purchasesCsv, purchasesExportError, purchasesHeaders, purchasesLines, purchasesPdf, purchasesValues, purchasesXlsx } from '../data/originalPurchasesExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { usePurchasesNamedChoices } from '../hooks/usePurchasesNamedChoices'
import { OriginalPurchasesChoiceControls } from './OriginalPurchasesChoiceControls'
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
  named_selector_current_witness_unavailable: 'Назви або повні дані змінилися. Завантажте назви знову та повторіть відбір.',
  catalogue_publication_unavailable_or_invalid: 'Узгоджені назви для цього періоду ще недоступні.',
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function usePurchasesRun(capability: PurchasesCapability, callerKey: string | null, canGenerate: boolean,
  from: string, through: string, measures: PurchasesMeasure[], selection: PurchasesSelections, named: PurchasesChoices | null, key: string) {
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
      const request = purchasesNamedRequest(purchasesRequest(capability, from, through, measures), selection, named)
      const result = await readPurchases(request, controller.signal)
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
export function OriginalPurchasesPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: PurchasesCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [measures, setMeasures] = useState<PurchasesMeasure[]>([...purchasesDefaultMeasures])
  const names = usePurchasesNamedChoices(capability, callerKey, canGenerate, from, through), named = names.run.lastRun
  const [selection, setSelection] = useState<{ key: string; witness: string | null; values: PurchasesSelections }>({ key: '', witness: null, values: emptyPurchasesSelections() })
  const currentSelection = named && selection.key === names.key && selection.witness === named.ResultSha256
  const selected = currentSelection ? selection.values : emptyPurchasesSelections()
  const key = JSON.stringify([callerKey, canGenerate, capability, from, through, measures, selected, named?.FieldWitnessSha256 ?? null])
  const delivery = usePurchasesRun(capability, callerKey, canGenerate, from, through, measures, selected, named, key)
  const result = delivery.run.lastRun, busy = delivery.run.isLoading || delivery.exporting || names.run.isLoading, exportError = result?.Available ? purchasesExportError(result) : null
  function select(field: PurchasesField, keys: string[]) {
    delivery.invalidate(); setSelection({ key: names.key, witness: named?.ResultSha256 ?? null, values: { ...selected, [field]: [...keys] } })
  }
  return <Stack gap="md">
    <Text size="sm">{t('Закупки за період: статус партії → контрагент → номенклатура. За замовчуванням — кількість у базових одиницях, вартість, ПДВ і вага.')}</Text>
    <OriginalPeriodDateInputs from={from} through={through} busy={busy}
      changeFrom={value => { delivery.invalidate(); setFrom(value) }} changeThrough={value => { delivery.invalidate(); setThrough(value) }} />
    <MultiSelect label={t('Показники')} value={measures} data={purchasesMeasures.map(value => ({ value, label: t(purchasesLabels[value]) }))} maxValues={purchasesMeasures.length} disabled={busy}
      onChange={value => { const selected = new Set(value); delivery.invalidate(); setMeasures(purchasesMeasures.filter(m => selected.has(m))) }} />
    <OriginalPurchasesChoiceControls names={names} selection={selected} busy={busy} permitted={delivery.permitted}
      periodError={purchasesPeriodError(from, through)} onSelect={select}
      onLoad={() => { delivery.invalidate(); setSelection({ key: '', witness: null, values: emptyPurchasesSelections() }); void names.load() }} />
    <Text size="sm" c="dimmed">{t('Кількості й вага мають три десяткові знаки; вартість і ПДВ — два. Період охоплює календарні дні до 23:59:59. Повна відповідність підсумкам оригіналу 1С ще не підтверджена.')}</Text>
    {delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    <Group><Button disabled={!delivery.permitted || !!delivery.error || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(format => <Button key={format} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!exportError}
        onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    <PurchasesResultView result={result} />
  </Stack>
}
