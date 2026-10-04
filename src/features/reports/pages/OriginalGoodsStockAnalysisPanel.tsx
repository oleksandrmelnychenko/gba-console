import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readGoodsAnalysis } from '../api/originalGoodsStockAnalysisApi'
import { goodsAnalysisPeriodError, goodsAnalysisRequest, type GoodsAnalysisCapability, type GoodsAnalysisResult } from '../data/originalGoodsStockAnalysis'
import { goodsAnalysisCsv, goodsAnalysisExportError, goodsAnalysisHeaders, goodsAnalysisLines, goodsAnalysisPdf, goodsAnalysisValues, goodsAnalysisXlsx } from '../data/originalGoodsStockAnalysisExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalSalesGrid } from './OriginalSalesGrid'
import { WarehousePeriodFilters } from './WarehousePeriodControls'

const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function AnalysisGrid({ result }: { result: GoodsAnalysisResult }) {
  const lines = useMemo(() => goodsAnalysisLines(result), [result])
  return <OriginalSalesGrid lines={lines} headers={goodsAnalysisHeaders} totals={result.Totals ? goodsAnalysisValues(result.Totals) : null} />
}
type Choice = { value: string; label: string }
function useAnalysisRun(capability: GoodsAnalysisCapability, callerKey: string | null, canGenerate: boolean,
  from: string, through: string, warehouses: string[], products: string[], key: string, received: (result: GoodsAnalysisResult) => void) {
  const run = useReportRunState<GoodsAnalysisResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), latest = useRef(key)
  const activeExport = useRef<AbortController | null>(null)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort(); activeExport.current?.abort() } }, [key])
  const periodError = goodsAnalysisPeriodError(from, through)
  const permitted = canGenerate && !!callerKey && capability.Executable
  function invalidate() { active.current?.abort(); latest.current = ''; activeExport.current?.abort(); run.clear() }
  async function generate() {
    if (!permitted || periodError || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const result = await readGoodsAnalysis(goodsAnalysisRequest(capability, from, through, warehouses, products), controller.signal)
      if (!controller.signal.aborted) { update({ lastRun: result }); received(result) }
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати аналіз залишків.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.Available || exporting || goodsAnalysisExportError(result)) return
    const controller = new AbortController(); activeExport.current?.abort(); activeExport.current = controller
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([goodsAnalysisCsv(result)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await goodsAnalysisXlsx(result) : await goodsAnalysisPdf(result)
      if (!controller.signal.aborted && latest.current === key) download(blob, `goods-stock-analysis-${result.From}-${result.Through}.${format}`)
    } catch (failure) { if (!controller.signal.aborted && latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, exporting, periodError, permitted, invalidate, generate, exportFile }
}
function AnalysisResult({ result }: { result: GoodsAnalysisResult | null }) {
  const { t } = useI18n()
  return <>{result && !result.Available ? <Alert color="yellow">{t('Для звіту потрібні повні початкові залишки товарів, рухи і продажі за вибраний період. Частковий звіт не формується.')}
    {result.Dependency?.MissingMonth ? ` ${t('Відсутній місяць:')} ${result.Dependency.MissingMonth}` : null}</Alert> : null}
    {result?.Available ? <>{result.MissingCaptionMappings.length ? <Text size="sm" c="dimmed">{t('Частину назв не зіставлено; усі кількості включено.')}</Text> : null}
      <AnalysisGrid key={result.ResultSha256} result={result} /></> : null}</>
}
export function OriginalGoodsStockAnalysisPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: GoodsAnalysisCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [selection, setSelection] = useState<{ scope: string; warehouses: string[]; products: string[] }>({ scope: '', warehouses: [], products: [] })
  const [choices, setChoices] = useState<{ scope: string; warehouses: Choice[]; products: Choice[] } | null>(null)
  const scope = JSON.stringify([callerKey, canGenerate, capability, from, through])
  const warehouses = selection.scope === scope ? selection.warehouses : [], products = selection.scope === scope ? selection.products : []
  const key = JSON.stringify([scope, warehouses, products]), currentChoices = choices?.scope === scope ? choices : null
  const delivery = useAnalysisRun(capability, callerKey, canGenerate, from, through, warehouses, products, key, result => {
    if (result.Available) setChoices({ scope, warehouses: result.Choices['Склад'].map(c => ({ value: c.Key, label: c.Caption })),
      products: result.Choices['Номенклатура'].map(c => ({ value: c.Key, label: c.Caption })) })
  })
  const result = delivery.run.lastRun, busy = delivery.run.isLoading || delivery.exporting
  const exportError = result?.Available ? goodsAnalysisExportError(result) : null
  return <Stack gap="md"><Text size="sm">{t('Залишки товарів без продажів за вибраний період: склад → товар.')}</Text>
    <WarehousePeriodFilters from={from} through={through} products={products} warehouses={warehouses}
      productChoices={currentChoices?.products ?? []} warehouseChoices={currentChoices?.warehouses ?? []} warehouseSupported busy={busy}
      changeFrom={value => { delivery.invalidate(); setFrom(value) }} changeThrough={value => { delivery.invalidate(); setThrough(value) }}
      selectProducts={value => { delivery.invalidate(); setSelection({ scope, warehouses, products: value }) }}
      selectWarehouses={value => { delivery.invalidate(); setSelection({ scope, warehouses: value, products }) }} />
    <Text size="sm" c="dimmed">{t('Товари з продажами виключаються незалежно від вибраного складу.')}</Text>
    {delivery.periodError ? <Alert color="yellow">{t(delivery.periodError)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    <Group><Button disabled={!delivery.permitted || !!delivery.periodError || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(format => <Button key={format} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!exportError}
        onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    <AnalysisResult result={result} />
  </Stack>
}
