import { PartialCoverageLine } from '../../../shared/ui/product-movement-history/PartialCoverageLine'
import { PhysicalQuantityExceptionLine } from '../../../shared/ui/product-movement-history/PhysicalQuantityExceptionNotice'
import { ReportRowPagination } from './ReportRowPagination'
import { movementSelection } from '../data/currentVparivanieMovements'
import { ReportTableScrollArea } from './ReportTableScrollArea'
import { Alert, Button, Checkbox, Group, Stack, Text } from '@mantine/core'
import { Map as MapIcon } from 'lucide-react'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { readCurrentVparivanieRegional } from '../api/currentVparivanieRegionalApi'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, currentVparivanieConfigurationError, currentVparivanieFullScopeAvailable,
  currentVparivanieStockSentence } from '../data/currentVparivanie'
import { currentVparivanieV2CellKey, currentVparivanieV2Columns } from '../data/currentVparivanieV2Export'
import { currentVparivanieRegionalAvailable, currentVparivanieRegionalRequest, type CurrentVparivanieRegionalResult } from '../data/currentVparivanieRegional'
import { currentRegionalCellText, currentRegionalColumnCaption, currentRegionalCsv,
  currentRegionalPdf, currentRegionalXlsx, CURRENT_REGIONAL_TITLE } from '../data/currentVparivanieRegionalExport'
import type { ReportDataset, ReportRequestBody } from '../types'
import './report-inline-preview.css'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function RegionalTable({ result }: { result: CurrentVparivanieRegionalResult }) {
  const [page, setPage] = useState(0)
  const columns = currentVparivanieV2Columns(result)
  const currentPage = Math.min(page, Math.max(0, Math.ceil(result.Rows.length / 50) - 1))
  const first = currentPage * 50
  const visible = result.Rows.slice(first, first + 50)
  return <Stack gap="xs"><ReportTableScrollArea minWidth={1100} label="Регіональна форма Аналіз залишків і продажів">
    <table className="app-static-table"><thead><tr>{CURRENT_VPARIVANIE_PRODUCT_CAPTIONS.map(caption => <th scope="col" key={caption}>{caption}</th>)}
      {columns.map(key => <th scope="col" key={key} className="app-table-cell-number">{currentRegionalColumnCaption(key)}</th>)}</tr></thead>
      <tbody>{visible.map(row => {
        const cells = new Map(row.Cells.map(cell => [currentVparivanieV2CellKey(cell), cell]))
        return <tr key={row.ProductId}>
          {[row.Article, row.Name, row.Description, row.Group, row.OE, row.Size, row.Top].map((value, index) =>
            <th scope="row" key={index}>{value ?? '—'}</th>)}
          {columns.map(key => <td key={key} className="app-table-cell-number">{currentRegionalCellText(cells.get(key)) || '—'}</td>)}
        </tr>
      })}</tbody></table>
  </ReportTableScrollArea>
    <ReportRowPagination total={result.Rows.length} offset={first} onChange={offset => setPage(offset / 50)} /></Stack>
}

function RegionalFullScopeCheckbox({ dataset, checked, disabled, onChange }: {
  dataset: ReportDataset | null; checked?: boolean; disabled: boolean
  onChange?: (value: boolean) => void
}) {
  if (!onChange || !currentVparivanieFullScopeAvailable(dataset)) return null
  return <Checkbox label="Повний вибраний набір товарів"
    checked={checked ?? false} disabled={disabled}
    onChange={event => onChange(event.currentTarget.checked)} />
}

function regionalConfigurationError(dataset: ReportDataset | null, request: ReportRequestBody): string | null {
  const invalid = dataset ? currentVparivanieConfigurationError(request, dataset) : null
  if (invalid) return invalid
  return movementSelection(request)
    ? 'Прихід і розхід доступні у звичайній формі звіту. Для регіональної форми вимкніть ці показники.'
    : null
}

export function CurrentVparivanieRegionalPanel({ dataset, request: form, enabled, disabled, fullScope, onFullScopeChange, historyRun }: {
  dataset: ReportDataset | null; request: ReportRequestBody; enabled: boolean; disabled: boolean
  fullScope?: boolean; onFullScopeChange?: (value: boolean) => void; historyRun?: { token: number; excel: boolean } | null
}) {
  const derived = useMemo(() => currentVparivanieRegionalRequest(form), [form])
  const request = derived.request
  const requestKey = JSON.stringify(request)
  const currentKey = useRef(requestKey)
  const active = useRef<AbortController | null>(null)
  const [snapshot, setSnapshot] = useState<{ key: string; result: CurrentVparivanieRegionalResult } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [exportKey, setExportKey] = useState<string | null>(null)
  useEffect(() => {
    currentKey.current = requestKey
    return () => { active.current?.abort() }
  }, [requestKey])
  const available = currentVparivanieRegionalAvailable(dataset)
  const result = snapshot?.key === requestKey ? snapshot.result : null
  const error = failure?.key === requestKey ? failure.message : null
  const busy = busyKey === requestKey, exporting = exportKey === requestKey
  const rejected = derived.error ?? regionalConfigurationError(dataset, request)

  const handledHistory = useRef(0)
  const runHistory = useEffectEvent(async (run: { token: number; excel: boolean }) => {
    const next = await read(run.excel)
    if (next === undefined) return
    handledHistory.current = run.token
    if (next && run.excel) await exportDocument('xlsx', next)
  })
  useEffect(() => {
    if (!historyRun || historyRun.token === handledHistory.current || !dataset || !available || !enabled || disabled || rejected || busy) return
    void runHistory(historyRun)
  }, [historyRun, dataset, available, enabled, disabled, rejected, busy, requestKey])

  async function read(excelIntent = false): Promise<CurrentVparivanieRegionalResult | null | undefined> {
    if (!dataset || !available || !enabled || disabled || busy || rejected) return undefined
    active.current?.abort()
    const controller = new AbortController(); active.current = controller
    setBusyKey(requestKey); setSnapshot(null); setFailure(null)
    try {
      const next = excelIntent ? await readCurrentVparivanieRegional(dataset, request, controller.signal, true)
        : await readCurrentVparivanieRegional(dataset, request, controller.signal)
      if (!controller.signal.aborted) setSnapshot({ key: requestKey, result: next })
      return controller.signal.aborted ? undefined : next
    } catch (cause) {
      if (controller.signal.aborted) return undefined
      setFailure({ key: requestKey, message: cause instanceof Error ? cause.message : 'Не вдалося сформувати регіональну форму.' })
    } finally { if (!controller.signal.aborted) setBusyKey(null) }
    return null
  }

  async function exportDocument(format: 'csv' | 'xlsx' | 'pdf', source: CurrentVparivanieRegionalResult | null = result) {
    const result = source
    if (!result || exporting || !enabled || disabled) return
    setExportKey(requestKey); setFailure(null)
    try {
      const blob = format === 'csv' ? new Blob([currentRegionalCsv(result)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await currentRegionalXlsx(result) : await currentRegionalPdf(result)
      if (currentKey.current === requestKey) download(blob, `${CURRENT_REGIONAL_TITLE} ${result.From}-${result.To}.${format}`)
    } catch (cause) {
      setFailure({ key: requestKey, message: cause instanceof Error ? cause.message : 'Не вдалося сформувати файл.' })
    } finally { setExportKey(null) }
  }

  if (!available) return null
  return <section aria-label="Регіональна форма Аналіз залишків і продажів">
    <Stack gap="sm"><Text component="h2" fw={600} size="sm"><Group component="span" gap={6} wrap="nowrap"><MapIcon size={16} style={{ flexShrink: 0 }} aria-hidden="true" />{CURRENT_REGIONAL_TITLE}</Group></Text>
      <RegionalFullScopeCheckbox dataset={dataset} checked={fullScope}
        disabled={!enabled || disabled || busy || exporting || !!(request.currentVparivanieMovements ?? request.CurrentVparivanieMovements)} onChange={onFullScopeChange} />
      <Group><Button loading={busy} disabled={!enabled || disabled || !!rejected || exporting} onClick={() => void read(false)}>
        Показати регіональну форму</Button>
        {(['csv', 'xlsx', 'pdf'] as const).map(format => <Button key={format} variant="default"
          disabled={!result || !enabled || disabled || exporting || busy} onClick={() => void exportDocument(format)}>
          {`Завантажити ${format.toUpperCase()}`}</Button>)}</Group>
      {rejected ? <Text size="xs" c="gray.7" role="status">{rejected}</Text> : null}
      {error ? <Alert color="red">{error}</Alert> : null}
      {result ? <><PartialCoverageLine coverage={result.PhysicalCoverage} /><PhysicalQuantityExceptionLine exceptions={result.PhysicalQuantityExceptions} />
        <Text size="xs" c="dimmed">Продажі: {result.From} — {result.To}. {currentVparivanieStockSentence(result.StockAnchor)}
        ∅ — кількість невідома.</Text><RegionalTable key={requestKey} result={result} /></> : null}
    </Stack>
  </section>
}
