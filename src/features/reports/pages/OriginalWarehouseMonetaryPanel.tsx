import { receiptChoiceScope, receiptChoiceValues, type ReceiptCaptionContext, type WarehouseReceiptKey } from '../data/warehouseReceiptCaptions'
import { WarehouseReceiptCaptionControls, WarehouseReceiptCaptionStatus } from './WarehouseReceiptCaptionControls'
import { Alert, Button, Group, Stack, Table, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { WarehousePeriodFilters } from './WarehousePeriodControls'
import { readWarehouseMonetary } from '../api/originalWarehouseMonetaryApi'
import { warehouseMonetaryPeriodError, warehouseMonetaryRequest, type WarehouseMonetaryCapability, type WarehouseMonetaryResult } from '../data/originalWarehouseMonetary'
import { warehouseMonetaryCsv, warehouseMonetaryHeaders, warehouseMonetaryExportError, warehouseMonetaryPdf, warehouseMonetaryXlsx, warehouseMonetaryValues } from '../data/originalWarehouseMonetaryExport'
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
type MonetaryChoice = { value: string; label: string }
type MonetaryChoices = { scope: string; products: MonetaryChoice[]; warehouses: MonetaryChoice[]; receiptScope: string; receiptContext?: ReceiptCaptionContext }
const exportFormats = ['csv', 'xlsx', 'pdf'] as const

function MonetaryTable({ result }: { result: WarehouseMonetaryResult }) {
  const { t } = useI18n(); const [page, setPage] = useState(0)
  // Screen paging does not change the accepted result or the full export matrix.
  const rows = useMemo(() => result.Rows.flatMap(row => [
    { key: JSON.stringify([row.Product]), cells: [row.Caption, 'Підсумок товару', ...warehouseMonetaryValues(row.Resources)] },
    ...row.Receipts.map(child => ({ key: JSON.stringify([row.Product, child.Receipt.Type, child.Receipt.Table, child.Receipt.Reference]),
      cells: [row.Caption, child.Caption, ...warehouseMonetaryValues(child.Resources)] })),
  ]), [result])
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1)), first = current * 50
  return <Stack gap="xs"><Group><Button variant="light" size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text size="xs">{rows.length ? first + 1 : 0}–{Math.min(first + 50, rows.length)} / {rows.length}</Text>
    <Button variant="light" size="xs" disabled={first + 50 >= rows.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1900}><Table><Table.Thead><Table.Tr>{warehouseMonetaryHeaders.map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{rows.slice(first, first + 50).map(row => <Table.Tr key={row.key}>{row.cells.map((cell, column) => <Table.Td className={column >= 2 ? 'app-money' : undefined} key={warehouseMonetaryHeaders[column]}>{cell}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
      {result.Totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={2}>{t('Разом')}</Table.Th>{warehouseMonetaryValues(result.Totals).map((value, i) => <Table.Td className="app-money" key={warehouseMonetaryHeaders[i + 2]}>{value}</Table.Td>)}</Table.Tr></Table.Tfoot> : null}
    </Table></Table.ScrollContainer>{!rows.length ? <Text>{t('У повністю перевіреному періоді рядків немає.')}</Text> : null}</Stack>
}

function useMonetaryRun({ capability, callerKey, canGenerate, from, through, products, warehouses, receiptMode, receipts, key, onAvailable }: {
  capability: WarehouseMonetaryCapability; callerKey: string | null; canGenerate: boolean; from: string; through: string;
  products: string[]; warehouses: string[]; receiptMode: boolean; receipts: WarehouseReceiptKey[]; key: string; onAvailable: (result: WarehouseMonetaryResult) => void
}) {
  const [exporting, setExporting] = useState(false)
  const run = useReportRunState<WarehouseMonetaryResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const error = warehouseMonetaryPeriodError(from, through), report = run.lastRun
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  function invalidate() { active.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const result = await readWarehouseMonetary(warehouseMonetaryRequest(capability, from, through, products, warehouses, receiptMode, receipts), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: result }); onAvailable(result)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати відомість.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof exportFormats[number]) {
    if (!permitted || !report?.Available || exporting) return
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([warehouseMonetaryCsv(report)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await warehouseMonetaryXlsx(report) : await warehouseMonetaryPdf(report)
      if (latest.current === key) download(blob, `warehouse-monetary-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, report, error, permitted, exporting, invalidate, generate, exportFile,
    exportError: report?.Available ? warehouseMonetaryExportError(report) : null }
}

function MonetaryNotes() {
  const { t } = useI18n()
  return <>
    <Text size="sm" c="dimmed">{t('Назви складів — поточні назви довідника GBA. Непідтверджені назви не пропонуються для відбору; усі кількості й суми збережено.')}</Text>
    <Text size="sm" c="dimmed">{t('Період охоплює календарні дні від 00:00:00 до 23:59:59; дробова частина секунди після цієї межі не включається.')}</Text>
    <Text size="sm" c="dimmed">{t('Нульові спостережені рядки збережено. Повна відповідність усім налаштуванням 1С не підтверджена.')}</Text>
  </>
}

function MonetaryMessages({ error, runError }: { error: string | null; runError: string | null }) {
  const { t } = useI18n()
  return <>{error ? <Alert color="yellow">{t(error)}</Alert> : null}{runError ? <Alert color="red">{t(runError)}</Alert> : null}</>
}

function MonetaryActions({ permitted, invalidPeriod, loading, exporting, available, exportError, generate, exportFile }: {
  permitted: boolean; invalidPeriod: boolean; loading: boolean; exporting: boolean; available: boolean; exportError: boolean;
  generate: () => Promise<void>; exportFile: (format: typeof exportFormats[number]) => Promise<void>
}) {
  const { t } = useI18n()
  return <Group><Button disabled={!permitted || invalidPeriod || loading || exporting} loading={loading} onClick={() => { void generate() }}>{t('Сформувати')}</Button>
    {exportFormats.map(format => <Button key={format} variant="light" disabled={!permitted || !available || exporting || exportError}
      onClick={() => { void exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
}

function MonetaryResult({ report, exportError }: { report: WarehouseMonetaryResult | null; exportError: string | null }) {
  const { t } = useI18n()
  return <>
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    {report && !report.Available ? <Alert color="yellow">{t(dependencies[report.Code] ?? 'Повні узгоджені початкові залишки й місячні рухи цього періоду недоступні; частковий звіт не формується.')}</Alert> : null}
    {report?.Available ? <><WarehouseReceiptCaptionStatus context={report.ReceiptCaptions} fallback="Назви документів надходження недоступні. Усі кількості й суми включено; документи не об’єднано за схожими назвами." />
      <MonetaryTable key={report.ResultSha256} result={report} /></> : null}
  </>
}

export function OriginalWarehouseMonetaryPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: WarehouseMonetaryCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(); const [from, setFrom] = useState(initialFrom); const [through, setThrough] = useState(initialThrough)
  const [receiptMode, setReceiptMode] = useState(false)
  const [selection, setSelection] = useState<{ scope: string; products: string[]; warehouses: string[]; receipts: WarehouseReceiptKey[] }>({ scope: '', products: [], warehouses: [], receipts: [] })
  const [choices, setChoices] = useState<MonetaryChoices | null>(null)
  const receiptEnabled = receiptMode && capability.CurrentReceiptCaptionChoicesSupported === true
  const periodScope = JSON.stringify([callerKey, canGenerate, capability, from, through, receiptEnabled])
  const products = selection.scope === periodScope ? selection.products : [], warehouses = selection.scope === periodScope ? selection.warehouses : []
  const receipts = selection.scope === periodScope ? selection.receipts : []
  const proofScope = receiptChoiceScope(periodScope, products, warehouses)
  const key = JSON.stringify([periodScope, products, warehouses, receipts])
  const delivery = useMonetaryRun({ capability, callerKey, canGenerate, from, through, products, warehouses, receiptMode: receiptEnabled, receipts, key,
    onAvailable: result => setChoices({ scope: periodScope, products: result.ProductChoices.map(v => ({ value: v.Key, label: v.Caption })),
      warehouses: (result.WarehouseChoices ?? []).map(v => ({ value: v.Key, label: v.Caption })), receiptScope: proofScope, receiptContext: result.ReceiptCaptions }) })
  const currentChoices = choices?.scope === periodScope ? choices : null
  return <Stack gap="md"><Text size="sm">{t('Кількість, вартість і ПДВ у наших таблицях за період: товар → документ надходження. Вартість і ПДВ — суми управлінського обліку без валютного перерахунку.')}</Text>
    <WarehousePeriodFilters from={from} through={through} products={products} warehouses={warehouses} productChoices={currentChoices?.products ?? []}
      warehouseChoices={currentChoices?.warehouses ?? []} warehouseSupported={!!capability.CurrentWarehouseCaptionChoicesSupported}
      busy={delivery.run.isLoading || delivery.exporting} changeFrom={value => { delivery.invalidate(); setFrom(value) }}
      changeThrough={value => { delivery.invalidate(); setThrough(value) }} selectProducts={value => { delivery.invalidate(); setSelection({ scope: periodScope, products: value, warehouses, receipts: [] }) }}
      selectWarehouses={value => { delivery.invalidate(); setSelection({ scope: periodScope, products, warehouses: value, receipts: [] }) }} />
    <WarehouseReceiptCaptionControls supported={!!capability.CurrentReceiptCaptionChoicesSupported} enabled={receiptEnabled} scope={proofScope}
      context={currentChoices?.receiptScope === proofScope ? currentChoices.receiptContext : undefined} selected={receipts} busy={delivery.run.isLoading || delivery.exporting}
      toggle={value => { delivery.invalidate(); setReceiptMode(value) }} select={values => { delivery.invalidate(); setSelection({ scope: periodScope, products, warehouses,
        receipts: receiptChoiceValues(values, currentChoices?.receiptScope === proofScope ? currentChoices.receiptContext : undefined, receipts) }) }} />
    <MonetaryNotes />
    <MonetaryMessages error={delivery.error} runError={delivery.run.error} />
    <MonetaryActions permitted={delivery.permitted} invalidPeriod={!!delivery.error} loading={delivery.run.isLoading} exporting={delivery.exporting}
      available={!!delivery.report?.Available} exportError={!!delivery.exportError} generate={delivery.generate} exportFile={delivery.exportFile} />
    <MonetaryResult report={delivery.report} exportError={delivery.exportError} />
  </Stack>
}
