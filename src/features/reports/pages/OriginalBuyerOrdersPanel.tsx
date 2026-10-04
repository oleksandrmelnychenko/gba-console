import { Alert, Button, Group, MultiSelect, Stack, Table, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readBuyerOrders } from '../api/originalBuyerOrdersApi'
import { buyerOrdersPeriodError, buyerOrdersRequest, buyerOrdersValueKey, type BuyerOrdersGroupValue, type BuyerOrdersCapability, type BuyerOrdersResult } from '../data/originalBuyerOrders'
import { buyerOrdersCsv, buyerOrdersExportError, buyerOrdersHeaders, buyerOrdersPdf, buyerOrdersValues, buyerOrdersLines, buyerOrdersXlsx } from '../data/originalBuyerOrdersExport'
import { useReportRunState } from '../hooks/useReportRunState'
import { OriginalPeriodDateProductFilters } from './WarehousePeriodControls'

const dependencies: Record<string, string> = {
  original_buyer_orders_opening_publication_unavailable: 'Немає повного початкового залишку замовлень покупців для цього періоду.',
  original_buyer_orders_month_publication_unavailable: 'Не всі місячні рухи замовлень покупців синхронізовані повністю.',
  original_buyer_orders_normal_storage_unavailable: 'Сховище початкових залишків і рухів ще недоступне.',
  original_buyer_orders_amg_normal_producer_unavailable: 'Періодна відомість замовлень покупців AMG ще недоступна.',
}
const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function BuyerOrdersTable({ result }: { result: BuyerOrdersResult }) {
  const { t } = useI18n(); const [page, setPage] = useState(0)
  const lines = useMemo(() => buyerOrdersLines(result), [result])
  const current = Math.min(page, Math.max(0, Math.ceil(lines.length / 50) - 1)), offset = current * 50
  return <Stack gap="xs">
    <Group justify="space-between"><Button variant="light" size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
      <Text size="xs">{lines.length ? offset + 1 : 0}–{Math.min(offset + 50, lines.length)} / {lines.length}</Text>
      <Button variant="light" size="xs" disabled={offset + 50 >= lines.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1900}><Table striped highlightOnHover>
      <Table.Thead><Table.Tr>{buyerOrdersHeaders.map(label => <Table.Th key={label}>{t(label)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{lines.slice(offset, offset + 50).map(line => <Table.Tr key={line.key} style={line.subtotal ? { fontWeight: 600 } : undefined}>
        {line.cells.map((cell, i) => <Table.Td key={buyerOrdersHeaders[i]} className={i >= 2 ? 'app-money' : undefined}>{cell}</Table.Td>)}
      </Table.Tr>)}</Table.Tbody>
      {result.BaseTotals && result.StoredTotals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={2}>{t('Разом')}</Table.Th>
        {buyerOrdersValues(result.BaseTotals, result.StoredTotals).map((value, i) => <Table.Td key={buyerOrdersHeaders[i + 2]} className="app-money">{value}</Table.Td>)}
      </Table.Tr></Table.Tfoot> : null}
    </Table></Table.ScrollContainer>
    {lines.length === 0 ? <Text>{t('У повністю перевіреному періоді рядків немає.')}</Text> : null}
  </Stack>
}

function useBuyerOrdersRun(capability: BuyerOrdersCapability, callerKey: string | null, canGenerate: boolean,
  from: string, through: string, filters: BuyerOrdersGroupValue[], key: string, onAvailable: (result: BuyerOrdersResult) => void) {
  const run = useReportRunState<BuyerOrdersResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key)
  const [exporting, setExporting] = useState(false)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const error = buyerOrdersPeriodError(from, through), report = run.lastRun
  const permitted = canGenerate && !!callerKey && capability.Executable && capability.World === 'fenix'
  function invalidate() { active.current?.abort(); latest.current = ''; run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    latest.current = key; const update = run.begin()
    try {
      const response = await readBuyerOrders(buyerOrdersRequest(capability, from, through, filters), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: response }); if (response.NormalInputsComplete) onAvailable(response)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати відомість замовлень покупців.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    if (!permitted || !report?.Available || exporting) return
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([buyerOrdersCsv(report)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await buyerOrdersXlsx(report) : await buyerOrdersPdf(report)
      if (latest.current === key) download(blob, `buyer-orders-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, error, report, permitted, exporting, invalidate, generate, exportFile,
    exportError: report?.Available ? buyerOrdersExportError(report) : null }
}

function BuyerOrdersActions({ permitted, invalid, loading, exporting, report, exportError, generate, exportFile }: {
  permitted: boolean; invalid: boolean; loading: boolean; exporting: boolean; report: BuyerOrdersResult | null; exportError: string | null;
  generate: () => Promise<void>; exportFile: (format: typeof formats[number]) => Promise<void>
}) {
  const { t } = useI18n()
  return <Group><Button disabled={!permitted || invalid || loading || exporting} loading={loading} onClick={() => { void generate() }}>{t('Сформувати')}</Button>
    {formats.map(format => <Button key={format} variant="light" disabled={!permitted || !report?.Available || exporting || !!exportError}
      onClick={() => { void exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
}

function BuyerOrdersOutput({ report, exportError }: { report: BuyerOrdersResult | null; exportError: string | null }) {
  const { t } = useI18n()
  return <>
    {exportError ? <Alert color="yellow">{t(exportError)}</Alert> : null}
    {report && !report.Available ? <Alert color="yellow">{t(dependencies[report.Code] ?? 'Повні узгоджені початкові залишки й місячні рухи замовлень покупців недоступні; частковий звіт не формується.')}</Alert> : null}
    {report && !report.Available && report.MissingProductRoleCount > 0 ? <Text>{t('Бракує підтверджених одиниць зберігання для товарів:')} {report.MissingProductRoleCount}</Text> : null}
    {report && !report.Available && report.MissingStorageUnitCount > 0 ? <Text>{t('Бракує придатних коефіцієнтів одиниць зберігання:')} {report.MissingStorageUnitCount}</Text> : null}
    {report?.Available ? <><Alert color="yellow">{t('Назви замовлень недоступні. Кожне замовлення збережено окремо разом з усіма рядками.')}</Alert>
      <BuyerOrdersTable key={report.ResultSha256} result={report} /></> : null}
  </>
}

function BuyerOrdersIntrinsicFilters({ filters, choices, busy, change }: {
  filters: BuyerOrdersGroupValue[]; choices: BuyerOrdersResult['FieldChoices']; busy: boolean; change: (value: BuyerOrdersGroupValue[]) => void
}) {
  const { t } = useI18n()
  const fields = [{ field: 0, label: 'Замовлення' }, { field: 2, label: 'Статуси партій' }, { field: 3, label: 'Угоди' }] as const
  return <Group align="flex-start">{fields.map(({ field, label }) => {
    const options = choices.filter(c => c.Value.Field === field), available = new Map(options.map(c => [buyerOrdersValueKey(c.Value), c.Value]))
    return <MultiSelect key={field} label={t(label)} searchable clearable disabled={busy || !options.length} style={{ flex: 1, minWidth: 200 }}
      placeholder={t('Усі')} data={options.map(c => ({ value: buyerOrdersValueKey(c.Value), label: c.Caption }))}
      value={filters.filter(f => f.Field === field).map(buyerOrdersValueKey)} onChange={keys => change([...filters.filter(f => f.Field !== field), ...keys.map(k => available.get(k)!).filter(Boolean)])} />
  })}</Group>
}

export function OriginalBuyerOrdersPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: BuyerOrdersCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(); const [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [selection, setSelection] = useState<{ scope: string; filters: BuyerOrdersGroupValue[] }>({ scope: '', filters: [] })
  const [choices, setChoices] = useState<{ scope: string; result: BuyerOrdersResult } | null>(null)
  const scope = JSON.stringify([callerKey, canGenerate, capability, from, through]), filters = selection.scope === scope ? selection.filters : []
  const key = JSON.stringify([scope, filters]), currentChoices = choices?.scope === scope ? choices.result : null
  const delivery = useBuyerOrdersRun(capability, callerKey, canGenerate, from, through, filters, key, result => setChoices({ scope, result }))
  const change = (value: BuyerOrdersGroupValue[]) => { delivery.invalidate(); setSelection({ scope, filters: value }) }
  return <Stack gap="md"><Text size="sm">{t('Замовлення → товар; початковий залишок, надходження, витрати й кінцевий залишок у базових одиницях та одиницях зберігання.')}</Text>
    <OriginalPeriodDateProductFilters from={from} through={through} products={filters.filter(f => f.Field === 1).map(f => f.Reference)}
      productChoices={currentChoices?.ProductChoices.map(p => ({ value: p.Key, label: p.Caption })) ?? []}
      busy={delivery.run.isLoading || delivery.exporting} changeFrom={value => { delivery.invalidate(); setFrom(value) }}
      changeThrough={value => { delivery.invalidate(); setThrough(value) }} selectProducts={keys => change([...filters.filter(f => f.Field !== 1), ...keys.map(Reference => ({ Field: 1 as const, Type: null, Table: null, Reference }))])} />
    <BuyerOrdersIntrinsicFilters filters={filters} choices={currentChoices?.FieldChoices ?? []} busy={delivery.run.isLoading || delivery.exporting} change={change} />
    <Text size="sm" c="dimmed">{t('Варіанти відборів показано для повного обраного періоду після формування. Кілька значень одного поля об’єднуються; різні поля застосовуються разом.')}</Text>
    <Text size="sm" c="dimmed">{t('Період охоплює календарні дні від 00:00:00 до 23:59:59; дробова частина секунди після цієї межі не включається.')}</Text>
    <Text size="sm" c="dimmed">{t('Базову кількість обчислено з коефіцієнтом одиниці зберігання кожного товару перед групуванням. Показано точні значення; округлення 1С ще не підтверджене.')}</Text>
    {delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <BuyerOrdersActions permitted={delivery.permitted} invalid={!!delivery.error} loading={delivery.run.isLoading} exporting={delivery.exporting}
      report={delivery.report} exportError={delivery.exportError} generate={delivery.generate} exportFile={delivery.exportFile} />
    <BuyerOrdersOutput report={delivery.report} exportError={delivery.exportError} />
  </Stack>
}
