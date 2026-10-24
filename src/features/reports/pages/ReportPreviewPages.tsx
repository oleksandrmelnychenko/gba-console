import { memo, useEffect, useRef, useState } from 'react'
import { ActionIcon, Alert, Group, Text } from '@mantine/core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import '../../../shared/ui/paginator/paginator.css'
import { getStockReportPreviewPage } from '../api/reportsApi'
import type { NativeReportPreview } from '../data/nativeReportPreview'
import type { ReportRequestBody } from '../types'
import { ReportInlinePreview } from './ReportInlinePreview'
export const ReportPreviewPages = memo(function ReportPreviewPages({ initial, request, embedded = false }: { initial: NativeReportPreview; request: ReportRequestBody; embedded?: boolean }) {
  const [preview, setPreview] = useState(initial)
  const [pendingOffset, setPendingOffset] = useState<number | null>(null)
  const loading = pendingOffset !== null
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function page(offset: number) {
    if (!initial.ResultSession || loading) return
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    setPendingOffset(offset); setError(null)
    try {
      const result = await getStockReportPreviewPage(initial.ResultSession, request, offset, next.signal)
      if (controller.current === next && !next.signal.aborted) setPreview(result)
    } catch (error) {
      if (controller.current === next && !next.signal.aborted) setError(error instanceof Error ? error.message : 'Не вдалося завантажити сторінку.')
    } finally {
      if (controller.current === next && !next.signal.aborted) {
        setPendingOffset(null)
      }
    }
  }
  return <>
    {error ? <Alert color="red">{error}</Alert> : null}
    <ReportInlinePreview preview={preview} embedded={embedded} showPageNote={!initial.ResultSession} />
    {initial.ResultSession ? <footer className="report-preview-footer">
      <Text size="xs" className="report-preview-footer__note">
        {preview.Totals ? `Підсумок за всіма рядками: ${preview.Page.TotalVisibleRows}. ` : ''}
        {preview.Page.TotalVisibleRows > preview.Page.ReturnedRows ? 'Повний звіт — Excel / PDF.' : ''}
      </Text>
      <Group className="app-paginator report-preview-footer__pagination" gap={4} wrap="nowrap" role="navigation" aria-label="Сторінки звіту">
        <Text size="xs" className="report-preview-footer__range" aria-live="polite">{pendingOffset !== null ? `Завантаження…` : preview.Page.TotalVisibleRows === 0 ? '0 рядків' : `${preview.Page.Offset + 1}–${preview.Page.Offset + preview.Page.ReturnedRows} із ${preview.Page.TotalVisibleRows}`}</Text>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Попередні рядки" title="Попередні рядки" disabled={loading || preview.Page.Offset === 0} onClick={() => void page(Math.max(0, preview.Page.Offset - preview.Page.Limit))}><ChevronLeft size={16} /></ActionIcon>
        <ActionIcon variant="subtle" color="gray" size={30} aria-label="Наступні рядки" title="Наступні рядки" disabled={loading || !preview.Page.HasMore} loading={loading} onClick={() => void page(preview.Page.Offset + preview.Page.Limit)}><ChevronRight size={16} /></ActionIcon>
      </Group>
    </footer> : null}
  </>
})
