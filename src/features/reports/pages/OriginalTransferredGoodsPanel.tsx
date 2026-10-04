import { Alert, Button, Group, Stack, Table, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readTransferred } from '../api/originalTransferredGoodsApi'
import { transferredPeriodError, transferredRequest, type TransferredCapability, type TransferredResult } from '../data/originalTransferredGoods'
import { transferredCsv, transferredExportError, transferredHeaders, transferredPdf, transferredValues, transferredXlsx } from '../data/originalTransferredGoodsExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalPeriodDateProductFilters } from './WarehousePeriodControls'

const dependencies: Record<string, string> = {
  original_transferred_opening_publication_unavailable: 'Немає повного початкового залишку переданих товарів для цього періоду.',
  original_transferred_month_publication_unavailable: 'Не всі місячні рухи переданих товарів синхронізовані повністю.',
  original_transferred_normal_storage_unavailable: 'Сховище початкових залишків і рухів ще недоступне.',
  original_transferred_genuine_amg_normal_publication_unavailable: 'Періодна відомість переданих товарів AMG ще недоступна.',
}
const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function TransferredTable({ result }: { result: TransferredResult }) {
  const { t } = useI18n(); const [page, setPage] = useState(0)
  const lines = useMemo(() => result.Rows.flatMap(receipt => [
    { key: JSON.stringify([receipt.Receipt]), cells: [receipt.Caption, 'Підсумок документа', ...transferredValues(receipt.Resources)], subtotal: true },
    ...receipt.Products.map(product => ({ key: JSON.stringify([receipt.Receipt, product.Product]),
      cells: [receipt.Caption, product.Caption, ...transferredValues(product.Resources)], subtotal: false })),
  ]), [result])
  const current = Math.min(page, Math.max(0, Math.ceil(lines.length / 50) - 1)), offset = current * 50
  return <Stack gap="xs">
    <Group justify="space-between"><Button variant="light" size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
      <Text size="xs">{lines.length ? offset + 1 : 0}–{Math.min(offset + 50, lines.length)} / {lines.length}</Text>
      <Button variant="light" size="xs" disabled={offset + 50 >= lines.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1900}><Table striped highlightOnHover>
      <Table.Thead><Table.Tr>{transferredHeaders.map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{lines.slice(offset, offset + 50).map(line => <Table.Tr key={line.key} style={line.subtotal ? { fontWeight: 600 } : undefined}>
        {line.cells.map((cell, i) => <Table.Td key={transferredHeaders[i]} className={i >= 2 ? 'app-money' : undefined}>{cell}</Table.Td>)}
      </Table.Tr>)}</Table.Tbody>
      {result.Totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={2}>{t('Разом')}</Table.Th>
        {transferredValues(result.Totals).map((value, i) => <Table.Td key={transferredHeaders[i + 2]} className="app-money">{value}</Table.Td>)}
      </Table.Tr></Table.Tfoot> : null}
    </Table></Table.ScrollContainer>
    {lines.length === 0 ? <Text>{t('У повністю перевіреному періоді рядків немає.')}</Text> : null}
  </Stack>
}

function useTransferredRun(capability: TransferredCapability, callerKey: string | null, canGenerate: boolean,
  from: string, through: string, products: string[], key: string, onAvailable: (result: TransferredResult) => void) {
  const run = useReportRunState<TransferredResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key)
  const [exporting, setExporting] = useState(false)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const error = transferredPeriodError(from, through), report = run.lastRun
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  function invalidate() { active.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const response = await readTransferred(transferredRequest(capability, from, through, products), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: response }); if (response.Available) onAvailable(response)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати відомість переданих товарів.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    if (!permitted || !report?.Available || exporting) return
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([transferredCsv(report)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await transferredXlsx(report) : await transferredPdf(report)
      if (latest.current === key) download(blob, `transferred-goods-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, error, report, permitted, exporting, invalidate, generate, exportFile,
    exportError: report?.Available ? transferredExportError(report) : null }
}

function TransferredActions({ permitted, invalid, loading, exporting, report, exportError, generate, exportFile }: {
  permitted: boolean; invalid: boolean; loading: boolean; exporting: boolean; report: TransferredResult | null; exportError: string | null;
  generate: () => Promise<void>; exportFile: (format: typeof formats[number]) => Promise<void>
}) {
  const { t } = useI18n()
  return <Group><Button disabled={!permitted || invalid || loading || exporting} loading={loading} onClick={() => { void generate() }}>{t('Сформувати')}</Button>
    {formats.map(format => <Button key={format} variant="light" disabled={!permitted || !report?.Available || exporting || !!exportError}
      onClick={() => { void exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
}

function TransferredOutput({ report, exportError }: { report: TransferredResult | null; exportError: string | null }) {
  const { t } = useI18n()
  return <>
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    {report && !report.Available ? <Alert color="yellow">{t(dependencies[report.Code] ?? 'Повні узгоджені початкові залишки й місячні рухи переданих товарів недоступні; частковий звіт не формується.')}</Alert> : null}
    {report?.Available ? <><Alert color="yellow">{t('Назви документів надходження недоступні. Усі їхні рядки та суми включено окремо; товари згруповано всередині кожного документа.')}</Alert>
      <TransferredTable key={report.ResultSha256} result={report} /></> : null}
  </>
}

export function OriginalTransferredGoodsPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: TransferredCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(); const [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [selection, setSelection] = useState<{ scope: string; products: string[] }>({ scope: '', products: [] })
  const [choices, setChoices] = useState<{ scope: string; products: { value: string; label: string }[] } | null>(null)
  const scope = JSON.stringify([callerKey, canGenerate, capability, from, through]), products = selection.scope === scope ? selection.products : []
  const key = JSON.stringify([scope, products])
  const delivery = useTransferredRun(capability, callerKey, canGenerate, from, through, products, key,
    result => setChoices({ scope, products: result.ProductChoices.map(p => ({ value: p.Key, label: p.Caption })) }))
  return <Stack gap="md"><Text size="sm">{t('Документ надходження → товар; кількість, вартість і ПДВ для початкового залишку, надходжень, витрат і кінцевого залишку.')}</Text>
    <OriginalPeriodDateProductFilters from={from} through={through} products={products} productChoices={choices?.scope === scope ? choices.products : []}
      busy={delivery.run.isLoading || delivery.exporting} changeFrom={value => { delivery.invalidate(); setFrom(value) }}
      changeThrough={value => { delivery.invalidate(); setThrough(value) }} selectProducts={value => { delivery.invalidate(); setSelection({ scope, products: value }) }} />
    <Text size="sm" c="dimmed">{t('Відбір за документом надходження стане доступним після підтвердженого зіставлення його назви. Рядки документів без назв не вилучаються.')}</Text>
    <Text size="sm" c="dimmed">{t('Період охоплює календарні дні від 00:00:00 до 23:59:59; дробова частина секунди після цієї межі не включається.')}</Text>
    <Text size="sm" c="dimmed">{t('Кількість — записані одиниці; суми управлінського обліку показано без валютного перерахунку. Повна відповідність усім налаштуванням 1С не підтверджена.')}</Text>
    {delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <TransferredActions permitted={delivery.permitted} invalid={!!delivery.error} loading={delivery.run.isLoading} exporting={delivery.exporting}
      report={delivery.report} exportError={delivery.exportError} generate={delivery.generate} exportFile={delivery.exportFile} />
    <TransferredOutput report={delivery.report} exportError={delivery.exportError} />
  </Stack>
}
