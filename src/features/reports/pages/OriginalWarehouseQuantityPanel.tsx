import { Alert, Button, Group, Stack, Table, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { WarehousePeriodFilters } from './WarehousePeriodControls'
import { readWarehouseQuantity } from '../api/originalWarehouseQuantityApi'
import { warehouseQuantityPeriodError, warehouseQuantityRequest, type WarehouseQuantityCapability, type WarehouseQuantityResult } from '../data/originalWarehouseQuantity'
import { warehouseQuantityCsv, warehouseQuantityHeaders, warehouseQuantityExportError, warehouseQuantityPdf, warehouseQuantityXlsx } from '../data/originalWarehouseQuantityExport'
import { useReportRunState } from '../hooks/useReportRunState'

const dependencies: Record<string, string> = {
  original_warehouse_opening_publication_unavailable: 'Немає повного початкового залишку для цього періоду.',
  original_warehouse_month_publication_unavailable: 'Не всі місячні рухи цього періоду синхронізовані повністю.',
  original_warehouse_normal_storage_unavailable: 'Сховище початкових залишків і рухів ще недоступне.',
  original_warehouse_genuine_amg_normal_publication_unavailable: 'Періодний звіт AMG ще недоступний.',
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
type QuantityChoice = { value: string; label: string }
type QuantityChoices = { scope: string; products: QuantityChoice[]; warehouses: QuantityChoice[] }
const quantityKeys = ['Opening', 'Incoming', 'Outgoing', 'Closing'] as const
const exportFormats = ['csv', 'xlsx', 'pdf'] as const

function QuantityTable({ result }: { result: WarehouseQuantityResult }) {
  const { t } = useI18n(); const [page, setPage] = useState(0)
  // Screen paging does not change the accepted result or the full export matrix.
  const rows = useMemo(() => result.Rows.flatMap(row => [
    { key: JSON.stringify([row.Product]), cells: [row.Caption, 'Підсумок товару', ...quantityKeys.map(key => row.Quantity[key])] },
    ...row.Receipts.map(child => ({ key: JSON.stringify([row.Product, child.Receipt.Type, child.Receipt.Table, child.Receipt.Reference]),
      cells: [row.Caption, child.Caption, ...quantityKeys.map(key => child.Quantity[key])] })),
  ]), [result])
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1)), first = current * 50
  return <Stack gap="xs"><Group><Button variant="light" size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text size="xs">{rows.length ? first + 1 : 0}–{Math.min(first + 50, rows.length)} / {rows.length}</Text>
    <Button variant="light" size="xs" disabled={first + 50 >= rows.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={900}><Table><Table.Thead><Table.Tr>{warehouseQuantityHeaders.map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{rows.slice(first, first + 50).map(row => <Table.Tr key={row.key}>{row.cells.map((cell, column) => <Table.Td key={warehouseQuantityHeaders[column]}>{cell}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
      {result.Totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={2}>{t('Разом')}</Table.Th>{quantityKeys.map(key => <Table.Td key={key}>{result.Totals?.[key]}</Table.Td>)}</Table.Tr></Table.Tfoot> : null}
    </Table></Table.ScrollContainer>{!rows.length ? <Text>{t('У повністю перевіреному періоді рядків немає.')}</Text> : null}</Stack>
}

function useQuantityRun({ capability, callerKey, canGenerate, from, through, products, warehouses, key, onAvailable }: {
  capability: WarehouseQuantityCapability; callerKey: string | null; canGenerate: boolean; from: string; through: string;
  products: string[]; warehouses: string[]; key: string; onAvailable: (result: WarehouseQuantityResult) => void
}) {
  const [exporting, setExporting] = useState(false)
  const run = useReportRunState<WarehouseQuantityResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const error = warehouseQuantityPeriodError(from, through), report = run.lastRun
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  function invalidate() { active.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const result = await readWarehouseQuantity(warehouseQuantityRequest(capability, from, through, products, warehouses), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: result }); if (result.Available) onAvailable(result)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати відомість.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof exportFormats[number]) {
    if (!permitted || !report?.Available || exporting) return
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([warehouseQuantityCsv(report)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await warehouseQuantityXlsx(report) : await warehouseQuantityPdf(report)
      if (latest.current === key) download(blob, `warehouse-quantity-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, report, error, permitted, exporting, invalidate, generate, exportFile,
    exportError: report?.Available ? warehouseQuantityExportError(report) : null }
}

function QuantityNotes() {
  const { t } = useI18n()
  return <>
    <Text size="sm" c="dimmed">{t('Назви складів — поточні назви довідника GBA. Непідтверджені назви не пропонуються для відбору; усі кількості збережено. Назви й відбір документів надходження ще недоступні.')}</Text>
    <Text size="sm" c="dimmed">{t('Період охоплює календарні дні від 00:00:00 до 23:59:59; дробова частина секунди після цієї межі не включається.')}</Text>
    <Text size="sm" c="dimmed">{t('Нульові спостережені рядки збережено. Повна відповідність усім налаштуванням 1С не підтверджена.')}</Text>
  </>
}

function QuantityMessages({ error, runError }: { error: string | null; runError: string | null }) {
  const { t } = useI18n()
  return <>{error ? <Alert color="yellow">{t(error)}</Alert> : null}{runError ? <Alert color="red">{t(runError)}</Alert> : null}</>
}

function QuantityActions({ permitted, invalidPeriod, loading, exporting, available, exportError, generate, exportFile }: {
  permitted: boolean; invalidPeriod: boolean; loading: boolean; exporting: boolean; available: boolean; exportError: boolean;
  generate: () => Promise<void>; exportFile: (format: typeof exportFormats[number]) => Promise<void>
}) {
  const { t } = useI18n()
  return <Group><Button disabled={!permitted || invalidPeriod || loading || exporting} loading={loading} onClick={() => { void generate() }}>{t('Сформувати')}</Button>
    {exportFormats.map(format => <Button key={format} variant="light" disabled={!permitted || !available || exporting || exportError}
      onClick={() => { void exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
}

function QuantityResult({ report, exportError }: { report: WarehouseQuantityResult | null; exportError: string | null }) {
  const { t } = useI18n()
  return <>
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    {report && !report.Available ? <Alert color="yellow">{t(dependencies[report.Code] ?? 'Повні узгоджені початкові залишки й місячні рухи цього періоду недоступні; частковий звіт не формується.')}</Alert> : null}
    {report?.Available ? <><Alert color="yellow">{t('Назви документів надходження недоступні. Усі кількості включено; документи не об’єднано за схожими назвами.')}</Alert>
      <QuantityTable key={report.ResultSha256} result={report} /></> : null}
  </>
}

export function OriginalWarehouseQuantityPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: WarehouseQuantityCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(); const [from, setFrom] = useState(initialFrom); const [through, setThrough] = useState(initialThrough)
  const [selection, setSelection] = useState<{ scope: string; products: string[]; warehouses: string[] }>({ scope: '', products: [], warehouses: [] })
  const [choices, setChoices] = useState<QuantityChoices | null>(null)
  const periodScope = JSON.stringify([callerKey, canGenerate, capability, from, through])
  const products = selection.scope === periodScope ? selection.products : [], warehouses = selection.scope === periodScope ? selection.warehouses : []
  const key = JSON.stringify([periodScope, products, warehouses])
  const delivery = useQuantityRun({ capability, callerKey, canGenerate, from, through, products, warehouses, key,
    onAvailable: result => setChoices({ scope: periodScope, products: result.ProductChoices.map(v => ({ value: v.Key, label: v.Caption })),
      warehouses: (result.WarehouseChoices ?? []).map(v => ({ value: v.Key, label: v.Caption })) }) })
  const currentChoices = choices?.scope === periodScope ? choices : null
  return <Stack gap="md"><Text size="sm">{t('Записана кількість у наших таблицях за період: товар → документ надходження. Перерахунок одиниць не застосовується.')}</Text>
    <WarehousePeriodFilters from={from} through={through} products={products} warehouses={warehouses} productChoices={currentChoices?.products ?? []}
      warehouseChoices={currentChoices?.warehouses ?? []} warehouseSupported={!!capability.CurrentWarehouseCaptionChoicesSupported}
      busy={delivery.run.isLoading || delivery.exporting} changeFrom={value => { delivery.invalidate(); setFrom(value) }}
      changeThrough={value => { delivery.invalidate(); setThrough(value) }} selectProducts={value => { delivery.invalidate(); setSelection({ scope: periodScope, products: value, warehouses }) }}
      selectWarehouses={value => { delivery.invalidate(); setSelection({ scope: periodScope, products, warehouses: value }) }} />
    <QuantityNotes />
    <QuantityMessages error={delivery.error} runError={delivery.run.error} />
    <QuantityActions permitted={delivery.permitted} invalidPeriod={!!delivery.error} loading={delivery.run.isLoading} exporting={delivery.exporting}
      available={!!delivery.report?.Available} exportError={!!delivery.exportError} generate={delivery.generate} exportFile={delivery.exportFile} />
    <QuantityResult report={delivery.report} exportError={delivery.exportError} />
  </Stack>
}
