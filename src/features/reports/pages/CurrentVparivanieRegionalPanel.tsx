import { Alert, Button, Checkbox, Group, Stack, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { readCurrentVparivanieRegional } from '../api/currentVparivanieRegionalApi'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, currentVparivanieConfigurationError, currentVparivanieFullScopeAvailable } from '../data/currentVparivanie'
import { currentVparivanieV2CellKey, currentVparivanieV2Columns } from '../data/currentVparivanieV2Export'
import { currentVparivanieRegionalAvailable, type CurrentVparivanieRegionalResult } from '../data/currentVparivanieRegional'
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
  return <Stack gap="xs"><Group>
    <Button size="xs" variant="light" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Попередні рядки</Button>
    <Text size="xs">{result.Rows.length ? first + 1 : 0}–{first + visible.length} / {result.Rows.length}</Text>
    <Button size="xs" variant="light" disabled={first + visible.length >= result.Rows.length} onClick={() => setPage(currentPage + 1)}>Наступні рядки</Button>
  </Group><div className="report-inline-preview__scroll" tabIndex={0} role="region" aria-label="Регіональна форма Впарювання">
    <table><thead><tr>{CURRENT_VPARIVANIE_PRODUCT_CAPTIONS.map(caption => <th scope="col" key={caption}>{caption}</th>)}
      {columns.map(key => <th scope="col" key={key}>{currentRegionalColumnCaption(key)}</th>)}</tr></thead>
      <tbody>{visible.map(row => {
        const cells = new Map(row.Cells.map(cell => [currentVparivanieV2CellKey(cell), cell]))
        return <tr key={row.ProductId}>
          {[row.Article, row.Name, row.Description, row.Group, row.OE, row.Size, row.Top].map((value, index) =>
            <th scope="row" key={index}>{value ?? '—'}</th>)}
          {columns.map(key => <td key={key}>{currentRegionalCellText(cells.get(key)) || '—'}</td>)}
        </tr>
      })}</tbody></table>
  </div></Stack>
}

function RegionalFullScopeCheckbox({ dataset, checked, disabled, onChange }: {
  dataset: ReportDataset | null; checked?: boolean; disabled: boolean
  onChange?: (value: boolean) => void
}) {
  if (!onChange || !currentVparivanieFullScopeAvailable(dataset)) return null
  return <Checkbox label="Повний вибраний набір товарів"
    description="Читаються всі рядки вибраної групи або товарів. Якщо форма завелика, звузьте відбір."
    checked={checked ?? false} disabled={disabled}
    onChange={event => onChange(event.currentTarget.checked)} />
}

export function CurrentVparivanieRegionalPanel({ dataset, request, enabled, disabled, fullScope, onFullScopeChange }: {
  dataset: ReportDataset | null; request: ReportRequestBody; enabled: boolean; disabled: boolean
  fullScope?: boolean; onFullScopeChange?: (value: boolean) => void
}) {
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
  const rejected = dataset ? currentVparivanieConfigurationError(request, dataset) : null

  async function read() {
    if (!dataset || !available || !enabled || disabled || busy || rejected) return
    active.current?.abort()
    const controller = new AbortController(); active.current = controller
    setBusyKey(requestKey); setSnapshot(null); setFailure(null)
    try {
      const next = await readCurrentVparivanieRegional(dataset, request, controller.signal)
      if (!controller.signal.aborted) setSnapshot({ key: requestKey, result: next })
    } catch (cause) {
      if (!controller.signal.aborted) setFailure({ key: requestKey,
        message: cause instanceof Error ? cause.message : 'Не вдалося сформувати регіональну форму.' })
    } finally { if (!controller.signal.aborted) setBusyKey(null) }
  }

  async function exportDocument(format: 'csv' | 'xlsx' | 'pdf') {
    if (!result || exporting || !enabled || disabled) return
    setExportKey(requestKey); setFailure(null)
    try {
      const blob = format === 'csv' ? new Blob([currentRegionalCsv(result)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await currentRegionalXlsx(result) : await currentRegionalPdf(result)
      if (currentKey.current === requestKey) download(blob, `vparivanie-regional-${result.From}-${result.To}.${format}`)
    } catch (cause) {
      setFailure({ key: requestKey, message: cause instanceof Error ? cause.message : 'Не вдалося сформувати файл.' })
    } finally { setExportKey(null) }
  }

  if (!available) return null
  return <section className="app-section-card" aria-label="Регіональна форма Впарювання">
    <Stack gap="sm"><Text component="h2" fw={600} size="sm">{CURRENT_REGIONAL_TITLE}</Text>
      <RegionalFullScopeCheckbox dataset={dataset} checked={fullScope}
        disabled={!enabled || disabled || busy || exporting} onChange={onFullScopeChange} />
      <Text size="sm">Період і відбори — з конструктора. Окремий підсумок контрагентів та колонки регіональних кодів.</Text>
      <Group><Button loading={busy} disabled={!enabled || disabled || !!rejected || exporting} onClick={() => void read()}>
        Показати регіональну форму</Button>
        {(['csv', 'xlsx', 'pdf'] as const).map(format => <Button key={format} variant="light"
          disabled={!result || !enabled || disabled || exporting || busy} onClick={() => void exportDocument(format)}>
          {`Завантажити ${format.toUpperCase()}`}</Button>)}</Group>
      {error ? <Alert color="red">{error}</Alert> : null}
      {result ? <><Text size="xs" c="dimmed">Продажі: {result.From} — {result.To}. Залишки поточні.
        Порожня клітинка — факт відсутній; ∅ — кількість невідома.</Text><RegionalTable key={requestKey} result={result} /></> : null}
    </Stack>
  </section>
}
