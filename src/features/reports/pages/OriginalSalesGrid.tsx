import { ReportRowPagination } from './ReportRowPagination'
import { ReportTableScrollArea } from './ReportTableScrollArea'
import { Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
type SalesGridLine = { key: string; cells: string[]; subtotal: boolean }
export function OriginalSalesGrid({ lines, headers, totals, hierarchyColumns = 2 }: { lines: SalesGridLine[]; headers: string[]; totals: string[] | null; hierarchyColumns?: 2 | 3 | 4 }) {
  const { t } = useI18n(), [page, setPage] = useState(0)
  const current = Math.min(page, Math.max(0, Math.ceil(lines.length / 50) - 1)), start = current * 50
  const occurrences = new Map<string, number>()
  const keyedHeaders = headers.map(header => {
    const occurrence = occurrences.get(header) ?? 0
    occurrences.set(header, occurrence + 1)
    return { header, key: JSON.stringify([header, occurrence]) }
  })
  return <Stack gap="xs">
    <ReportTableScrollArea minWidth={1000}><Table className="app-static-table" striped><Table.Thead><Table.Tr>{keyedHeaders.map(({ header, key }, index) => <Table.Th key={key} className={index >= hierarchyColumns ? 'app-table-cell-number' : undefined}>{t(header)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{lines.slice(start, start + 50).map(line => <Table.Tr key={line.key} data-subtotal={line.subtotal || undefined}>
        {line.cells.map((cell, i) => <Table.Td key={`${i}:${headers[i]}`} className={i >= hierarchyColumns ? 'app-table-cell-number' : undefined}>{cell}</Table.Td>)}
      </Table.Tr>)}</Table.Tbody>{totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={hierarchyColumns}>{t('Разом')}</Table.Th>
        {totals.map((cell, i) => <Table.Td key={`${i}:${headers[i + hierarchyColumns]}`} className="app-table-cell-number">{cell}</Table.Td>)}
      </Table.Tr></Table.Tfoot> : null}</Table></ReportTableScrollArea>
    <ReportRowPagination total={lines.length} offset={start} onChange={offset => setPage(offset / 50)} />{!lines.length ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}</Stack>
}
