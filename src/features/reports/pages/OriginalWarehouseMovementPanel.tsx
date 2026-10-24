import { Alert, Button, Group, MultiSelect, Select, Stack, Table, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { AppDateInput } from '../../../shared/ui/AppDateInput'
import { readMovement } from '../api/originalWarehouseMovementApi'
import { movementAsOf, movementRequestError, type MovementPublication, type MovementRequest, type MovementResult } from '../data/originalWarehouseMovement'
import { movementCsv, movementExportError, movementHeaders, movementDisplayMatrix, movementPdf, movementXlsx } from '../data/originalWarehouseMovementExport'
import { ReportTableScrollArea } from './ReportTableScrollArea'

const formats = ['csv', 'xlsx', 'pdf'] as const
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function MovementTable({ result }: { result: MovementResult }) {
  const [page, setPage] = useState(0)
  const matrix = useMemo(() => movementDisplayMatrix(result), [result]), rows = matrix.slice(1, -1), total = matrix.at(-1)!
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1)), start = current * 50
  return <Stack gap="xs"><Group><Button variant="default" size="xs" disabled={!current} onClick={() => setPage(current - 1)}>Попередні рядки</Button>
    <Text size="xs">{rows.length ? start + 1 : 0}–{Math.min(start + 50, rows.length)} / {rows.length}</Text>
    <Button variant="default" size="xs" disabled={start + 50 >= rows.length} onClick={() => setPage(current + 1)}>Наступні рядки</Button></Group>
    <ReportTableScrollArea minWidth={1200}><Table className="app-static-table" aria-label="Рух товару за складськими документами">
      <Table.Thead><Table.Tr>{movementHeaders.map(label => <Table.Th key={label}>{label}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{rows.slice(start, start + 50).map((row, index) => <Table.Tr key={start + index}>{row.map((cell, col) => <Table.Td key={movementHeaders[col]} className={col >= 4 ? 'app-table-cell-number' : undefined}>{cell}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
      <Table.Tfoot><Table.Tr>{total.map((cell, col) => <Table.Th key={movementHeaders[col]} className={col >= 4 ? 'app-table-cell-number' : undefined}>{cell}</Table.Th>)}</Table.Tr></Table.Tfoot>
    </Table></ReportTableScrollArea></Stack>
}
function MovementResultView({ result }: { result: MovementResult }) {
  return <Stack gap="xs"><Text fw={600} aria-label="Період сформованого руху">Сформовано: {result.Scope.From} — {result.Scope.Through} · {result.Scope.Article}</Text>
    <Text size="sm">Дані з 1С станом на {movementAsOf(result.Capture!)} (Київ).</Text>
    {result.Scope.Through === result.Capture!.Through && !result.Capture!.ThroughDayComplete ? <Alert color="yellow">Останній день періоду ще не завершений у джерельному зрізі.</Alert> : null}
    {result.MissingCaptionMappings.length ? <Text size="sm" c="dimmed">Для документів без назви показано номер і дату; якщо їх немає — ідентифікатор. Склади без назви також позначено ідентифікатором.</Text> : null}
    <MovementTable key={result.ResultSha256} result={result} />
  </Stack>
}
type MovementDelivery = { result: MovementResult | null; error: string | null; status: 'idle' | 'loading' | 'exporting'; owner: AbortController | null }
function useMovementDelivery(publication: MovementPublication, request: MovementRequest, permitted: boolean) {
  const [state, setState] = useState<MovementDelivery>({ result: null, error: null, status: 'idle', owner: null })
  const active = useRef<AbortController | null>(null), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort() } }, [])
  const validation = movementRequestError(request, publication)
  function begin(status: MovementDelivery['status']) {
    const owner = new AbortController(); active.current?.abort(); active.current = owner
    setState(current => ({ ...current, owner, status, error: null }))
    return owner
  }
  function complete(owner: AbortController, patch: Partial<MovementDelivery>) {
    if (!alive.current || owner.signal.aborted) return
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
function MovementForm({ publication, canGenerate }: { publication: MovementPublication; canGenerate: boolean }) {
  const [request, setRequest] = useState<MovementRequest>(() => ({ Version: 1, World: 'fenix',
    From: publication.Capture.From > `${publication.Capture.Through.slice(0, 7)}-01` ? publication.Capture.From : `${publication.Capture.Through.slice(0, 7)}-01`,
    Through: publication.Capture.Through, Article: publication.Products[0].Article, Warehouses: publication.Warehouses.slice(0, 32).map(w => w.Reference).sort() }))
  const { From: from, Through: through, Article: article, Warehouses: warehouses } = request
  const run = useMovementDelivery(publication, request, canGenerate), busy = run.loading || run.exporting
  const pending = run.result && (run.result.Scope.From !== from || run.result.Scope.Through !== through || run.result.Scope.Article !== article
    || JSON.stringify(run.result.Scope.Warehouses) !== JSON.stringify(warehouses))
  const exportError = run.result ? movementExportError(run.result) : null
  return <Stack gap="md"><Text size="sm">Склад → товар → документ руху. Початковий залишок, прихід, розхід та кінцевий залишок у кількості.</Text>
    <Text size="sm" c="dimmed">Доступні лише товари й склади опублікованого зрізу: {publication.Capture.From} — {publication.Capture.Through}. Повна відповідність усім налаштуванням 1С не підтверджена.</Text>
    <Group grow><AppDateInput label="Від" type="date" value={from} disabled={busy} onChange={e => { const value = e.currentTarget.value; setRequest(current => ({ ...current, From: value })) }} />
      <AppDateInput label="До" type="date" value={through} disabled={busy} onChange={e => { const value = e.currentTarget.value; setRequest(current => ({ ...current, Through: value })) }} /></Group>
    <Select label="Товар" value={article} searchable disabled={busy} data={publication.Products.map(p => ({ value: p.Article, label: `${p.Article} · ${p.Name}${p.Unit ? ` · ${p.Unit}` : ''}` }))} onChange={value => { if (value) setRequest(current => ({ ...current, Article: value })) }} />
    <MultiSelect label="Склади" value={warehouses} searchable clearable maxValues={32} disabled={busy} data={publication.Warehouses.map(w => ({ value: w.Reference, label: w.Name }))} onChange={value => setRequest(current => ({ ...current, Warehouses: [...value].sort() }))} />
    {run.validation ? <Alert color="yellow">{run.validation}</Alert> : null}{run.error ? <Alert color="red">{run.error}</Alert> : null}
    {pending ? <Text size="sm" c="orange.8">Налаштування змінено. Таблиця й файли залишаються за попереднім сформованим періодом до застосування.</Text> : null}
    <Group><Button loading={run.loading} disabled={!canGenerate || !!run.validation || busy} onClick={() => { void run.generate() }}>Застосувати й показати</Button>
      {formats.map(format => <Button key={format} variant="default" disabled={!canGenerate || !run.result || !!exportError || busy} onClick={() => { void run.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    {exportError ? <Alert color="yellow">{exportError}</Alert> : null}
    {run.result ? <MovementResultView result={run.result} /> : <Text size="sm" c="dimmed">Оберіть період, товар і склади та застосуйте налаштування.</Text>}
  </Stack>
}
export function OriginalWarehouseMovementPanel({ publications, callerKey, canGenerate }: { publications: MovementPublication[]; callerKey: string | null; canGenerate: boolean }) {
  const [selected, setSelected] = useState(publications[0]?.Capture.ManifestSha256 ?? '')
  const publication = publications.find(p => p.Capture.ManifestSha256 === selected)
  if (!canGenerate || !callerKey) return <Text>Немає права формування.</Text>
  return <Stack gap="md">{publications.length > 1 ? <Select label="Опублікований період" value={selected}
    data={publications.map(p => ({ value: p.Capture.ManifestSha256, label: `${p.Capture.From} — ${p.Capture.Through} · ${movementAsOf(p.Capture)}` }))}
    onChange={value => { if (value) setSelected(value) }} /> : null}
    {publication ? <MovementForm key={`${callerKey}:${selected}`} publication={publication} canGenerate={canGenerate} /> : <Text>Опубліковані дані поки недоступні.</Text>}
  </Stack>
}
