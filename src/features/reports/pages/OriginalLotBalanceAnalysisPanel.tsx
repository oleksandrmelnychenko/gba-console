import { Alert, Button, Group, MultiSelect, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readLotAnalysis } from '../api/originalLotBalanceAnalysisApi'
import { lotAnalysisPeriodError, lotAnalysisRequest, type LotAnalysisCapability, type LotAnalysisResult } from '../data/originalLotBalanceAnalysis'
import { lotAnalysisCsv, lotAnalysisExportError, lotAnalysisHeaders, lotAnalysisLines, lotAnalysisPdf, lotAnalysisValues, lotAnalysisXlsx } from '../data/originalLotBalanceAnalysisExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalSalesGrid } from './OriginalSalesGrid'
import { OriginalPeriodDateProductFilters } from './WarehousePeriodControls'

const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function AnalysisGrid({ result }: { result: LotAnalysisResult }) {
  const lines = useMemo(() => lotAnalysisLines(result), [result])
  return <OriginalSalesGrid lines={lines} headers={lotAnalysisHeaders} totals={result.Totals ? lotAnalysisValues(result.Totals) : null} />
}
type Choice = { value: string; label: string }
function useAnalysisRun(capability: LotAnalysisCapability, callerKey: string | null, canGenerate: boolean,
  from: string, through: string, warehouses: string[], products: string[], key: string, received: (result: LotAnalysisResult) => void) {
  const run = useReportRunState<LotAnalysisResult>(key), [exporting, setExporting] = useState(false)
  const active = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const periodError = lotAnalysisPeriodError(from, through)
  const permitted = canGenerate && !!callerKey && capability.Executable
  function invalidate() { active.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || periodError || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const result = await readLotAnalysis(lotAnalysisRequest(capability, from, through, warehouses, products), controller.signal)
      if (!controller.signal.aborted) { update({ lastRun: result }); received(result) }
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати аналіз залишків.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    const result = run.lastRun
    if (!permitted || !result?.Available || exporting || lotAnalysisExportError(result)) return
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([lotAnalysisCsv(result)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await lotAnalysisXlsx(result) : await lotAnalysisPdf(result)
      if (latest.current === key) download(blob, `lot-balance-analysis-${result.From}-${result.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, exporting, periodError, permitted, invalidate, generate, exportFile }
}
function AnalysisResult({ result }: { result: LotAnalysisResult | null }) {
  const { t } = useI18n()
  return <>{result && !result.Available ? <Alert color="yellow">{t('Для звіту потрібні повні початкові залишки, рухи партій і продажі за вибраний період. Частковий звіт не формується.')}
    {result.Dependency?.MissingMonth ? ` ${t('Відсутній місяць:')} ${result.Dependency.MissingMonth}` : null}</Alert> : null}
    {result?.Available ? <>{result.MissingCaptionMappings.length ? <Text size="sm" c="dimmed">{t('Частину назв не зіставлено; усі кількості та суми включено.')}</Text> : null}
      <AnalysisGrid key={result.ResultSha256} result={result} /></> : null}</>
}
export function OriginalLotBalanceAnalysisPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: LotAnalysisCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
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
  const exportError = result?.Available ? lotAnalysisExportError(result) : null
  return <Stack gap="md"><Text size="sm">{t('Залишки партій без продажів за вибраний період: склад → товар. Вартість включає ПДВ.')}</Text>
    <OriginalPeriodDateProductFilters from={from} through={through} products={products} productChoices={currentChoices?.products ?? []} busy={busy}
      changeFrom={value => { delivery.invalidate(); setFrom(value) }} changeThrough={value => { delivery.invalidate(); setThrough(value) }}
      selectProducts={value => { delivery.invalidate(); setSelection({ scope, warehouses, products: value }) }} />
    <MultiSelect label={t('Склади')} placeholder={t('Усі склади; підтверджені назви з’являться після формування')}
      data={currentChoices?.warehouses ?? []} value={warehouses} searchable clearable maxValues={256}
      disabled={busy || (!currentChoices?.warehouses.length && !warehouses.length)}
      onChange={value => { delivery.invalidate(); setSelection({ scope, warehouses: value, products }) }} />
    <Text size="sm" c="dimmed">{t('Товари з продажами виключаються незалежно від вибраного складу. Відбір за покупцем для цього варіанта недоступний.')}</Text>
    {delivery.periodError ? <Alert color="yellow">{t(delivery.periodError)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    <Group><Button disabled={!delivery.permitted || !!delivery.periodError || busy} loading={delivery.run.isLoading} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(format => <Button key={format} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!exportError}
        onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    <AnalysisResult result={result} />
  </Stack>
}
