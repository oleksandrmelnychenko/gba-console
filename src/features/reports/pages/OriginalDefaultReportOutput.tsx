import { useBusyState } from '../../../shared/hooks/useBusyState'
import { ReportRowPagination } from './ReportRowPagination'
import { ReportTableScrollArea } from './ReportTableScrollArea'
import { Alert, Button, Group, Stack, Table, Text } from '@mantine/core'
import { useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { defaultSheetBlob, defaultSheetExportError, type OriginalDefaultSheet } from '../data/originalDefaultReportExport'

export function OriginalDefaultReportOutput({ sheet, filename, allowExport = true }: { sheet: OriginalDefaultSheet; filename: string; allowExport?: boolean }) {
  const { t } = useI18n(), [page, setPage] = useState(0), [busy, setBusy, tryStartBusy] = useBusyState(), [error, setError] = useState<string | null>(null)
  const alive = useRef(false)
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function releaseExport() {
    if (alive.current) { setBusy(false) }
  }
  const current = Math.min(page, Math.max(0, Math.ceil(sheet.lines.length / 50) - 1)), offset = current * 50, exportError = defaultSheetExportError(sheet)
  async function exportFile(format: 'csv' | 'xlsx' | 'pdf') {
    if (!allowExport || busy || exportError) return
    if (!tryStartBusy()) return
    setError(null)
    try {
      const blob = await defaultSheetBlob(sheet, format)
      if (!alive.current) return
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = `${filename}-${sheet.from}-${sheet.through}.${format}`
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.') }
    finally { releaseExport() }
  }
  return <Stack gap="sm"><Group>{(['csv', 'xlsx', 'pdf'] as const).map(format => <Button key={format} variant="light" disabled={!allowExport || busy || !!exportError}
    onClick={() => { void exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    {exportError || error ? <Alert color="yellow">{t(exportError ?? error ?? '')}</Alert> : null}

    <ReportTableScrollArea minWidth={1100}><Table className="app-static-table" striped><Table.Thead><Table.Tr>{sheet.headers.map((header, index) => <Table.Th key={header} className={index >= sheet.labelColumns ? 'app-table-cell-number' : undefined}>{t(header)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{sheet.lines.slice(offset, offset + 50).map(line => <Table.Tr key={line.key} data-subtotal={line.subtotal || undefined}>
        {line.cells.map((cell, index) => <Table.Td key={sheet.headers[index]} className={index >= sheet.labelColumns ? 'app-table-cell-number' : undefined}>{cell}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
      {sheet.total ? <Table.Tfoot><Table.Tr>{sheet.total.map((cell, index) => <Table.Th key={sheet.headers[index]} className={index >= sheet.labelColumns ? 'app-table-cell-number' : undefined}>{cell}</Table.Th>)}</Table.Tr></Table.Tfoot> : null}
    </Table></ReportTableScrollArea>
    <ReportRowPagination total={sheet.lines.length} offset={offset} onChange={offset => setPage(offset / 50)} />{!sheet.lines.length ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}
  </Stack>
}
