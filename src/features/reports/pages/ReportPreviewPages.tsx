import { memo, useEffect, useRef, useState } from 'react'
import { ActionIcon, Alert, Group, Text } from '@mantine/core'
import { ChevronLeft, ChevronRight, ChevronsLeft } from 'lucide-react'
import '../../../shared/ui/paginator/paginator.css'
import { getStockReportPreviewPage, type ReportPreviewColumnRequest } from '../api/reportsApi'
import { isPartialColumnWindow, previewColumnWindow, type NativeReportPreview } from '../data/nativeReportPreview'
import { columnWindowText } from '../data/reportWideColumns'
import type { ReportRequestBody } from '../types'
import { ReportInlinePreview } from './ReportInlinePreview'

type PendingPage = { rows: boolean; columns: boolean; forward: boolean }

export const ReportPreviewPages = memo(function ReportPreviewPages({ initial, request, embedded = false }: { initial: NativeReportPreview; request: ReportRequestBody; embedded?: boolean }) {
  const [preview, setPreview] = useState(initial)
  const [columnHistory, setColumnHistory] = useState<number[]>([])
  const [pending, setPending] = useState<PendingPage | null>(null)
  const loading = pending !== null
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const columnWindow = previewColumnWindow(preview)
  const partialColumns = isPartialColumnWindow(columnWindow)
  async function page(rows: number, columns: ReportPreviewColumnRequest | undefined, history: number[]) {
    if (!initial.ResultSession || loading) return
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    const columnOffset = columnWindow?.ColumnOffset ?? 0
    setPending({ rows: rows !== preview.Page.Offset, columns: (columns?.offset ?? 0) !== columnOffset, forward: (columns?.offset ?? 0) > columnOffset }); setError(null)
    try {
      const result = columns ? await getStockReportPreviewPage(initial.ResultSession, request, rows, next.signal, columns)
        : await getStockReportPreviewPage(initial.ResultSession, request, rows, next.signal)
      if (controller.current === next && !next.signal.aborted) { setPreview(result); setColumnHistory(history) }
    } catch (error) {
      if (controller.current === next && !next.signal.aborted) setError(error instanceof Error ? error.message : 'Не вдалося завантажити сторінку.')
    } finally {
      if (controller.current === next && !next.signal.aborted) {
        setPending(null)
      }
    }
  }
  const currentColumns = (offset: number): ReportPreviewColumnRequest | undefined =>
    columnWindow ? { offset, limit: columnWindow.ColumnLimit } : undefined
  const pageRows = (offset: number) => void page(offset, currentColumns(columnWindow?.ColumnOffset ?? 0), columnHistory)
  const nextColumns = () => {
    if (!columnWindow?.HasMoreColumns) return
    void page(preview.Page.Offset, currentColumns(columnWindow.ColumnOffset + columnWindow.ReturnedColumns), [...columnHistory, columnWindow.ColumnOffset])
  }
  const previousColumns = () => {
    if (!columnWindow || columnWindow.ColumnOffset === 0) return
    const previous = columnHistory.at(-1) ?? Math.max(0, columnWindow.ColumnOffset - columnWindow.ColumnLimit)
    void page(preview.Page.Offset, currentColumns(previous), columnHistory.slice(0, -1))
  }
  const firstColumns = () => {
    if (!columnWindow || columnWindow.ColumnOffset === 0) return
    void page(preview.Page.Offset, currentColumns(0), [])
  }
  return <>
    {error ? <Alert color="red">{error}</Alert> : null}
    <ReportInlinePreview preview={preview} embedded={embedded} showPageNote={!initial.ResultSession} />
    {initial.ResultSession ? <footer className="report-preview-footer">
      <Text size="xs" className="report-preview-footer__note">
        {preview.Totals ? `Підсумок за всіма рядками: ${preview.Page.TotalVisibleRows}. ` : ''}
        {preview.Page.TotalVisibleRows > preview.Page.ReturnedRows || partialColumns ? 'Повний звіт — Excel / PDF.' : ''}
      </Text>
      {columnWindow && partialColumns ? <Group className="app-paginator report-preview-footer__pagination" gap={4} wrap="nowrap" role="navigation" aria-label="Колонки звіту">
        <Text size="xs" className="report-preview-footer__range" aria-live="polite">{pending?.columns ? 'Завантаження колонок…' : columnWindowText(columnWindow.ColumnOffset, columnWindow.ReturnedColumns, columnWindow.TotalColumns)}</Text>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Перші колонки" title="Перші колонки" disabled={loading || columnWindow.ColumnOffset === 0} onClick={firstColumns}><ChevronsLeft size={16} /></ActionIcon>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Попередні колонки" title="Попередні колонки" disabled={loading || columnWindow.ColumnOffset === 0} onClick={previousColumns}><ChevronLeft size={16} /></ActionIcon>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Наступні колонки" title="Наступні колонки" disabled={loading || !columnWindow.HasMoreColumns} loading={!!pending?.columns && pending.forward} onClick={nextColumns}><ChevronRight size={16} /></ActionIcon>
      </Group> : null}
      <Group className="app-paginator report-preview-footer__pagination" gap={4} wrap="nowrap" role="navigation" aria-label="Сторінки звіту">
        <Text size="xs" className="report-preview-footer__range" aria-live="polite">{pending?.rows ? `Завантаження…` : preview.Page.TotalVisibleRows === 0 ? '0 рядків' : `${preview.Page.Offset + 1}–${preview.Page.Offset + preview.Page.ReturnedRows} із ${preview.Page.TotalVisibleRows}`}</Text>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Попередні рядки" title="Попередні рядки" disabled={loading || preview.Page.Offset === 0} onClick={() => pageRows(Math.max(0, preview.Page.Offset - preview.Page.Limit))}><ChevronLeft size={16} /></ActionIcon>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Наступні рядки" title="Наступні рядки" disabled={loading || !preview.Page.HasMore} loading={!!pending?.rows} onClick={() => pageRows(preview.Page.Offset + preview.Page.Limit)}><ChevronRight size={16} /></ActionIcon>
      </Group>
    </footer> : null}
  </>
})
