import { ActionIcon, Alert, Button, Group, MultiSelect, Select, Stack, Table, Text, Tooltip } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { ChevronLeft, ChevronRight, FileSpreadsheet, Info, MonitorPlay } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { TableChip } from '../../../shared/ui/TableChip'
import { PdfIcon } from '../../../shared/ui/PdfIcon'
import { WorkbookPeriodField, WorkbookSettings } from './workbook-desk/WorkbookSettings'
import { readMovement } from '../api/originalWarehouseMovementApi'
import { movementAsOf, movementRequestError, type MovementPublication, type MovementRequest, type MovementResult, type MovementRegistrar } from '../data/originalWarehouseMovement'
import { movementCsv, movementExportError, movementHeaders, movementWarehouseCaption, movementPdf, movementXlsx } from '../data/originalWarehouseMovementExport'
import { ReportTableScrollArea } from './ReportTableScrollArea'
import '../../../shared/ui/paginator/paginator.css'

const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function MovementDate({ value }: { value: string }) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec(value)
  return parts ? <span className="published-movement__date" title={value}>{parts[3]}.{parts[2]}.{parts[1]} <span>{parts[4]}</span></span> : <span>{value}</span>
}
function quantityLabel(value: string) {
  const [integer, fraction = ''] = value.split('.')
  const decimal = fraction.replace(/0+$/, '')
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (decimal ? `,${decimal}` : '')
}
function MovementTable({ result }: { result: MovementResult }) {
  const [page, setPage] = useState(0)
  const rows = useMemo(() => result.Rows.flatMap(warehouse => [
    { warehouse, document: null as MovementRegistrar | null, quantity: warehouse.Quantity },
    ...warehouse.Registrars.map(document => ({ warehouse, document, quantity: document.Quantity })),
  ]), [result])
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1)), start = current * 50
  const stages = ['Opening', 'Incoming', 'Outgoing', 'Closing'] as const
  return <Stack gap="xs">
    <ReportTableScrollArea minWidth={1080}><Table className="app-static-table published-movement__table" aria-label="Рух товару за складськими документами">
      <Table.Thead><Table.Tr>{movementHeaders.map((label, index) => <Table.Th key={label} className={index >= 4 ? 'app-table-cell-number' : undefined}>{label}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{rows.slice(start, start + 50).map(({ warehouse, document, quantity }, index) => <Table.Tr key={start + index} data-summary={!document || undefined}>
        <Table.Td><TableChip tone="storage" value={movementWarehouseCaption(warehouse)} /></Table.Td>
        <Table.Td><TableChip tone="product" value={warehouse.Article} /></Table.Td>
        <Table.Td>{document ? <TableChip tone="document" title={[document.Caption ?? document.Number, document.SourceDate].filter(Boolean).join(' · ') || `${document.RecorderType}:${document.RecorderReference}`} value={document.Caption ?? document.Number ?? document.SourceDate ?? `${document.RecorderType}:${document.RecorderReference}`} /> : 'Підсумок по складу'}</Table.Td>
        <Table.Td>{document ? <MovementDate value={document.SourcePeriod} /> : null}</Table.Td>
        {stages.map(stage => <Table.Td key={stage} className="app-table-cell-number">{quantityLabel(quantity[stage])}</Table.Td>)}
      </Table.Tr>)}</Table.Tbody>
      <Table.Tfoot><Table.Tr><Table.Th colSpan={4}>Разом по складах</Table.Th>{stages.map(stage => <Table.Th key={stage} className="app-table-cell-number">{quantityLabel(result.Totals![stage])}</Table.Th>)}</Table.Tr></Table.Tfoot>
    </Table></ReportTableScrollArea>
    <footer className="report-preview-footer">
      <Group className="app-paginator report-preview-footer__pagination" gap={4} wrap="nowrap" role="navigation" aria-label="Сторінки звіту">
        <Text size="xs" className="report-preview-footer__range" aria-live="polite">{rows.length ? `${start + 1}–${Math.min(start + 50, rows.length)} із ${rows.length}` : '0 рядків'}</Text>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Попередні рядки" disabled={!current} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></ActionIcon>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Наступні рядки" disabled={start + 50 >= rows.length} onClick={() => setPage(current + 1)}><ChevronRight size={16} /></ActionIcon>
      </Group>
    </footer>
  </Stack>
}
function MovementResultView({ result }: { result: MovementResult }) {
  const date = (value: string) => value.split('-').reverse().join('.')
  return <Stack gap={8}>
    <Group justify="space-between" gap={8} className="published-movement__result-meta">
      <Group gap={8}><Text size="sm" fw={600} aria-label="Період сформованого руху">{date(result.Scope.From)} — {date(result.Scope.Through)}</Text><TableChip tone="product" value={result.Scope.Article} /></Group>
      <Group gap={8} className="published-movement__source"><Text size="xs" c="dimmed">Станом на {movementAsOf(result.Capture!)} (Київ)</Text>
      {result.MissingCaptionMappings.length ? <Tooltip label="Для документів без назви показано номер і дату; якщо їх немає — ідентифікатор. Склади без назви також позначено ідентифікатором." multiline w={320}><ActionIcon variant="subtle" color="gray" size="sm" aria-label="Позначення документів без назви"><Info size={15} /></ActionIcon></Tooltip> : null}</Group>
    </Group>
    <MovementTable key={result.ResultSha256} result={result} />
  </Stack>
}
type MovementDelivery = { result: MovementResult | null; error: string | null; status: 'idle' | 'loading' | 'exporting'; owner: AbortController | null }
function useMovementDelivery(publication: MovementPublication, request: MovementRequest, permitted: boolean, onBusyChange?: (busy: boolean) => void) {
  const [state, setState] = useState<MovementDelivery>({ result: null, error: null, status: 'idle', owner: null })
  const active = useRef<AbortController | null>(null), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); onBusyChange?.(false) } }, [onBusyChange])
  const validation = movementRequestError(request, publication)
  function begin(status: MovementDelivery['status']) {
    const owner = new AbortController(); active.current?.abort(); active.current = owner; onBusyChange?.(true)
    setState(current => ({ ...current, owner, status, error: null }))
    return owner
  }
  function complete(owner: AbortController, patch: Partial<MovementDelivery>) {
    if (!alive.current || owner.signal.aborted) return
    if (patch.status === 'idle') onBusyChange?.(false)
    setState(current => current.owner === owner ? { ...current, ...patch } : current)
  }
  async function generate() {
    if (!permitted || validation || state.status !== 'idle') return
    const owner = begin('loading')
    try {
      const next = await readMovement(structuredClone(request), publication, owner.signal)
      complete(owner, next.Available ? { result: next } : { error: 'Для цього відбору немає повного підтвердженого початкового залишку та рухів. Попередній результат збережено.' })
    } catch (failure) {
      complete(owner, { error: failure instanceof Error ? failure.message : 'Не вдалося сформувати рух товару.',
        ...(failure instanceof ApiError && [401, 403].includes(failure.status) ? { result: null } : {}) })
    } finally { complete(owner, { status: 'idle' }) }
  }
  async function exportFile(format: typeof formats[number]) {
    const result = state.result
    if (!permitted || !result || state.status !== 'idle' || movementExportError(result)) return
    const owner = begin('exporting')
    try {
      const blob = format === 'csv' ? new Blob([movementCsv(result)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await movementXlsx(result) : await movementPdf(result)
      if (active.current === owner && alive.current && !owner.signal.aborted) download(blob, `warehouse-movement-${result.Scope.From}-${result.Scope.Through}.${format}`)
    } catch (failure) { complete(owner, { error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { complete(owner, { status: 'idle' }) }
  }
  return { result: state.result, error: state.error, loading: state.status === 'loading', exporting: state.status === 'exporting', validation, generate, exportFile }
}
function MovementForm({ publication, canGenerate, onBusyChange }: { publication: MovementPublication; canGenerate: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [request, setRequest] = useState<MovementRequest>(() => ({ Version: 1, World: 'fenix',
    From: publication.Capture.From > `${publication.Capture.Through.slice(0, 7)}-01` ? publication.Capture.From : `${publication.Capture.Through.slice(0, 7)}-01`,
    Through: publication.Capture.Through, Article: publication.Products[0].Article, Warehouses: publication.Warehouses.slice(0, 32).map(w => w.Reference).sort() }))
  const { From: from, Through: through, Article: article, Warehouses: warehouses } = request
  const run = useMovementDelivery(publication, request, canGenerate, onBusyChange), busy = run.loading || run.exporting
  const pending = run.result && (run.result.Scope.From !== from || run.result.Scope.Through !== through || run.result.Scope.Article !== article
    || JSON.stringify(run.result.Scope.Warehouses) !== JSON.stringify(warehouses))
  const exportError = run.result ? movementExportError(run.result) : null
  const monthStart = `${publication.Capture.Through.slice(0, 7)}-01`
  const periodStart = (days: number) => {
    const start = new Date(Date.parse(publication.Capture.Through) - (days - 1) * 86400000).toISOString().slice(0, 10)
    return start < publication.Capture.From ? publication.Capture.From : start
  }
  const presets = [
    { label: 'Місяць', from: monthStart < publication.Capture.From ? publication.Capture.From : monthStart, to: publication.Capture.Through },
    { label: '7 днів', from: periodStart(7), to: publication.Capture.Through },
    { label: '30 днів', from: periodStart(30), to: publication.Capture.Through },
  ]
  return <Stack gap={8} className="published-movement">
    <WorkbookSettings unified disabled={busy} advanced={null}
      period={<WorkbookPeriodField required from={from} to={through} minDate={publication.Capture.From} maxDate={publication.Capture.Through}
        presets={presets} error={null} disabled={busy}
        onFromChange={value => setRequest(current => ({ ...current, From: value }))}
        onToChange={value => setRequest(current => ({ ...current, Through: value }))} />}
      sections={[
        { id: 'product', title: 'Товар', summary: article, content:
          <Select aria-label="Товар" placeholder="Оберіть товар" value={article} searchable disabled={busy}
            data={publication.Products.map(p => ({ value: p.Article, label: `${p.Article} · ${p.Name}${p.Unit ? ` · ${p.Unit}` : ''}` }))}
            onChange={value => { if (value) setRequest(current => ({ ...current, Article: value })) }} /> },
        { id: 'warehouses', title: 'Склади', summary: `Вибрано: ${warehouses.length}`, compactSummary: String(warehouses.length), content:
          <MultiSelect aria-label="Склади" placeholder="Оберіть склади" value={warehouses} searchable clearable maxValues={32} disabled={busy}
            data={publication.Warehouses.map(w => ({ value: w.Reference, label: w.Name }))}
            onChange={value => setRequest(current => ({ ...current, Warehouses: [...value].sort() }))} /> },
      ]} />
    {run.validation ? <Alert color="yellow">{run.validation}</Alert> : null}{run.error ? <Alert color="red">{run.error}</Alert> : null}
    {pending ? <Text size="xs" c="orange.8">Налаштування змінено. Таблиця й файли залишаються за попереднім сформованим періодом до застосування.</Text> : null}
    <div className="workbook-actions" role="region" aria-label="Дії зі звітом">
      <div className="app-filter-bar workbook-toolbar"><div className="app-filter-actions workbook-actions__buttons published-movement__actions">
        <div className="workbook-actions__delivery">
          {formats.map(format => <Button key={format} variant="default" aria-label={format.toUpperCase()}
            leftSection={format === 'xlsx' ? <ExcelIcon size={16} /> : format === 'pdf' ? <PdfIcon size={18} /> : <FileSpreadsheet size={16} />}
            disabled={!canGenerate || !run.result || !!exportError || busy} onClick={() => { void run.exportFile(format) }}>{format === 'xlsx' ? 'Excel' : format.toUpperCase()}</Button>)}
          <Button leftSection={<MonitorPlay size={16} />} loading={run.loading} disabled={!canGenerate || !!run.validation || busy} onClick={() => { void run.generate() }}>Застосувати й показати</Button>
        </div>
      </div></div>
    </div>
    {exportError ? <Alert color="yellow">{exportError}</Alert> : null}
    <section className="workbook-result" aria-label="Результат">
      <h2 className="app-section-title">Результат</h2>
      {run.result ? <MovementResultView result={run.result} /> : <div className="published-movement__empty" role="status">Таблиці ще немає</div>}
    </section>
  </Stack>
}
export function OriginalWarehouseMovementPanel({ publications, callerKey, canGenerate, onBusyChange }: { publications: MovementPublication[]; callerKey: string | null; canGenerate: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [selected, setSelected] = useState(publications[0]?.Capture.ManifestSha256 ?? '')
  const publication = publications.find(p => p.Capture.ManifestSha256 === selected)
  if (!canGenerate || !callerKey) return <Text>Немає права формування.</Text>
  return <Stack gap="md">{publications.length > 1 ? <Select label="Опублікований період" value={selected}
    data={publications.map(p => ({ value: p.Capture.ManifestSha256, label: `${p.Capture.From} — ${p.Capture.Through} · ${movementAsOf(p.Capture)}` }))}
    onChange={value => { if (value) setSelected(value) }} /> : null}
    {publication ? <MovementForm key={`${callerKey}:${selected}`} publication={publication} canGenerate={canGenerate} onBusyChange={onBusyChange} /> : <Text>Опубліковані дані поки недоступні.</Text>}
  </Stack>
}
