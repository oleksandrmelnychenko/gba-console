import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Text } from '@mantine/core'
import { getStockReportPreviewPage } from '../api/reportsApi'
import type { NativeReportPreview } from '../data/nativeReportPreview'
import type { ReportRequestBody } from '../types'
import { ReportInlinePreview } from './ReportInlinePreview'
export function ReportPreviewPages({ initial, request, embedded = false }: { initial: NativeReportPreview; request: ReportRequestBody; embedded?: boolean }) {
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
    <ReportInlinePreview preview={preview} embedded={embedded} />
    {initial.ResultSession ? <Group justify="space-between">
      <Button variant="default" disabled={loading || preview.Page.Offset === 0} onClick={() => void page(Math.max(0, preview.Page.Offset - preview.Page.Limit))}>Попередні рядки</Button>
      <Text size="sm" aria-live="polite">{pendingOffset !== null ? `Завантаження від рядка ${pendingOffset + 1}…` : preview.Page.TotalVisibleRows === 0 ? '0 рядків' : `${preview.Page.Offset + 1}–${preview.Page.Offset + preview.Page.ReturnedRows} із ${preview.Page.TotalVisibleRows}`}</Text>
      <Button variant="default" disabled={loading || !preview.Page.HasMore} loading={loading} onClick={() => void page(preview.Page.Offset + preview.Page.Limit)}>Наступні рядки</Button>
    </Group> : null}
  </>
}
