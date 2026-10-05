import { Alert, Button, Group, Stack, Table, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { defaultSheetBlob, defaultSheetExportError, type OriginalDefaultSheet } from '../data/originalDefaultReportExport'

export function OriginalDefaultReportOutput({ sheet, filename }: { sheet: OriginalDefaultSheet; filename: string }) {
  const { t } = useI18n(), [page, setPage] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function releaseExport() {
    if (alive.current) { setBusy(false) }
  }
  const current = Math.min(page, Math.max(0, Math.ceil(sheet.lines.length / 50) - 1)), offset = current * 50, exportError = defaultSheetExportError(sheet)
  async function exportFile(format: 'csv' | 'xlsx' | 'pdf') {
    if (busy || exportError) return
    setBusy(true); setError(null)
    try {
      const blob = await defaultSheetBlob(sheet, format)
      if (!alive.current) return
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = `${filename}-${sheet.from}-${sheet.through}.${format}`
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.') }
    finally { releaseExport() }
  }
  return <Stack gap="sm"><Group>{(['csv', 'xlsx', 'pdf'] as const).map(format => <Button key={format} variant="light" disabled={busy || !!exportError}
    onClick={() => { void exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    {exportError || error ? <Alert color="yellow">{t(exportError ?? error ?? '')}</Alert> : null}
    <Group><Button size="xs" variant="light" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
      <Text size="xs">{sheet.lines.length ? offset + 1 : 0}–{Math.min(offset + 50, sheet.lines.length)} / {sheet.lines.length}</Text>
      <Button size="xs" variant="light" disabled={offset + 50 >= sheet.lines.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1100}><Table striped><Table.Thead><Table.Tr>{sheet.headers.map(header => <Table.Th key={header}>{t(header)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{sheet.lines.slice(offset, offset + 50).map(line => <Table.Tr key={line.key} fw={line.subtotal ? 600 : undefined}>
        {line.cells.map((cell, index) => <Table.Td key={sheet.headers[index]} className={index >= sheet.labelColumns ? 'app-money' : undefined}>{cell}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
      {sheet.total ? <Table.Tfoot><Table.Tr>{sheet.total.map((cell, index) => <Table.Th key={sheet.headers[index]}>{cell}</Table.Th>)}</Table.Tr></Table.Tfoot> : null}
    </Table></Table.ScrollContainer>{!sheet.lines.length ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}
  </Stack>
}
