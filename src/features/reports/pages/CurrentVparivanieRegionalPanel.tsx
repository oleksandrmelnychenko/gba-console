import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { readCurrentVparivanieRegional } from '../api/currentVparivanieRegionalApi'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, currentVparivanieConfigurationError } from '../data/currentVparivanie'
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
  const columns = currentVparivanieV2Columns(result)
  return <div className="report-inline-preview__scroll" tabIndex={0} role="region" aria-label="Регіональна форма Впарювання">
    <table><thead><tr>{CURRENT_VPARIVANIE_PRODUCT_CAPTIONS.map(caption => <th scope="col" key={caption}>{caption}</th>)}
      {columns.map(key => <th scope="col" key={key}>{currentRegionalColumnCaption(key)}</th>)}</tr></thead>
      <tbody>{result.Rows.map(row => {
        const cells = new Map(row.Cells.map(cell => [currentVparivanieV2CellKey(cell), cell]))
        return <tr key={row.ProductId}>
          {[row.Article, row.Name, row.Description, row.Group, row.OE, row.Size, row.Top].map((value, index) =>
            <th scope="row" key={index}>{value ?? '—'}</th>)}
          {columns.map(key => <td key={key}>{currentRegionalCellText(cells.get(key)) || '—'}</td>)}
        </tr>
      })}</tbody></table>
  </div>
}

export function CurrentVparivanieRegionalPanel({ dataset, request, enabled, disabled }: {
  dataset: ReportDataset | null; request: ReportRequestBody; enabled: boolean; disabled: boolean
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
      <Text size="sm">Період і відбори — з конструктора. Окремий підсумок контрагентів та колонки регіональних кодів.</Text>
      <Group><Button loading={busy} disabled={!enabled || disabled || !!rejected || exporting} onClick={() => void read()}>
        Показати регіональну форму</Button>
        {(['csv', 'xlsx', 'pdf'] as const).map(format => <Button key={format} variant="light"
          disabled={!result || !enabled || disabled || exporting || busy} onClick={() => void exportDocument(format)}>
          {`Завантажити ${format.toUpperCase()}`}</Button>)}</Group>
      {error ? <Alert color="red">{error}</Alert> : null}
      {result ? <><Text size="xs" c="dimmed">Продажі: {result.From} — {result.To}. Залишки поточні.
        Порожня клітинка — факт відсутній; ∅ — кількість невідома.</Text><RegionalTable result={result} /></> : null}
    </Stack>
  </section>
}
