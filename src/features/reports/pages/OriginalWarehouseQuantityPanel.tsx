import { Alert, Button, Group, MultiSelect, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
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
function QuantityTable({ result }: { result: WarehouseQuantityResult }) {
  const { t } = useI18n(); const [page, setPage] = useState(0)
  // Screen paging does not change the accepted result or the full export matrix.
  const rows = useMemo(() => result.Rows.flatMap(row => [[row.Caption, 'Підсумок товару', row.Quantity.Opening, row.Quantity.Incoming, row.Quantity.Outgoing, row.Quantity.Closing],
    ...row.Receipts.map(child => [row.Caption, child.Caption, child.Quantity.Opening, child.Quantity.Incoming, child.Quantity.Outgoing, child.Quantity.Closing])]), [result])
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1)), first = current * 50
  return <Stack gap="xs"><Group><Button variant="light" size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text size="xs">{rows.length ? first + 1 : 0}–{Math.min(first + 50, rows.length)} / {rows.length}</Text>
    <Button variant="light" size="xs" disabled={first + 50 >= rows.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={900}><Table><Table.Thead><Table.Tr>{warehouseQuantityHeaders.map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{rows.slice(first, first + 50).map((row, index) => <Table.Tr key={first + index}>{row.map((cell, column) => <Table.Td key={column}>{cell}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
      {result.Totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={2}>{t('Разом')}</Table.Th>{[result.Totals.Opening, result.Totals.Incoming, result.Totals.Outgoing, result.Totals.Closing].map((v, i) => <Table.Td key={i}>{v}</Table.Td>)}</Table.Tr></Table.Tfoot> : null}
    </Table></Table.ScrollContainer>{!rows.length ? <Text>{t('У повністю перевіреному періоді рядків немає.')}</Text> : null}</Stack>
}
export function OriginalWarehouseQuantityPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: WarehouseQuantityCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(); const [from, setFrom] = useState(initialFrom); const [through, setThrough] = useState(initialThrough)
  const [products, setProducts] = useState<string[]>([]); const [exporting, setExporting] = useState(false)
  const [choices, setChoices] = useState<{ scope: string; values: Array<{ value: string; label: string }> } | null>(null)
  const periodScope = JSON.stringify([callerKey, canGenerate, capability, from, through]), key = JSON.stringify([periodScope, products])
  const run = useReportRunState<WarehouseQuantityResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const error = warehouseQuantityPeriodError(from, through), report = run.lastRun
  const selectChoices = choices?.scope === periodScope ? choices.values : []
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  function invalidate() { active.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const result = await readWarehouseQuantity(warehouseQuantityRequest(capability, from, through, products), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: result }); if (result.Available) setChoices({ scope: periodScope, values: result.ProductChoices.map(v => ({ value: v.Key, label: v.Caption })) })
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати відомість.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: 'csv' | 'xlsx' | 'pdf') {
    if (!permitted || !report?.Available || exporting) return
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([warehouseQuantityCsv(report)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await warehouseQuantityXlsx(report) : await warehouseQuantityPdf(report)
      if (latest.current === key) download(blob, `warehouse-quantity-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  const exportError = report?.Available ? warehouseQuantityExportError(report) : null
  return <Stack gap="md"><Text size="sm">{t('Записана кількість у наших таблицях за період: товар → документ надходження. Перерахунок одиниць не застосовується.')}</Text>
    <Group grow><TextInput type="date" label={t('Початок періоду')} value={from} disabled={run.isLoading || exporting} onChange={e => { invalidate(); setProducts([]); setFrom(e.currentTarget.value) }} />
      <TextInput type="date" label={t('Кінець періоду')} value={through} disabled={run.isLoading || exporting} onChange={e => { invalidate(); setProducts([]); setThrough(e.currentTarget.value) }} /></Group>
    <MultiSelect label={t('Товари')} placeholder={t('Усі товари; назви для відбору з’являться після формування')} data={selectChoices} value={products} searchable clearable
      disabled={run.isLoading || exporting || !selectChoices.length} onChange={v => { invalidate(); setProducts(v) }} maxValues={256} />
    <Text size="sm" c="dimmed">{t('Відбір за складом і документом надходження недоступний: ще немає підтвердженого зіставлення їхніх назв з довідниками GBA.')}</Text>
    <Text size="sm" c="dimmed">{t('Період охоплює календарні дні від 00:00:00 до 23:59:59; дробова частина секунди після цієї межі не включається.')}</Text>
    <Text size="sm" c="dimmed">{t('Нульові спостережені рядки збережено. Повна відповідність усім налаштуванням 1С не підтверджена.')}</Text>
    {error ? <Alert color="yellow">{t(error)}</Alert> : null}{run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group><Button disabled={!permitted || !!error || run.isLoading || exporting} loading={run.isLoading} onClick={() => { void generate() }}>{t('Сформувати')}</Button>
      {(['csv', 'xlsx', 'pdf'] as const).map(format => <Button key={format} variant="light" disabled={!permitted || !report?.Available || exporting || !!exportError}
        onClick={() => { void exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    {report && !report.Available ? <Alert color="yellow">{t(dependencies[report.Code] ?? 'Повні узгоджені початкові залишки й місячні рухи цього періоду недоступні; частковий звіт не формується.')}</Alert> : null}
    {report?.Available ? <><Alert color="yellow">{t('Назви документів надходження недоступні. Усі кількості включено; документи не об’єднано за схожими назвами.')}</Alert>
      <QuantityTable key={report.ResultSha256} result={report} /></> : null}
  </Stack>
}
