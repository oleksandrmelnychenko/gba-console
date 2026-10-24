import { ReportRowPagination } from './ReportRowPagination'
import { ReportTableScrollArea } from './ReportTableScrollArea'
import { Stack, Table, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { FenixDiscountResult } from '../data/originalFenixClientDiscounts'
import { fenixDiscountDisplayPage } from '../data/originalFenixClientDiscountDisplay'
import { fenixDiscountHeaders } from '../data/originalFenixClientDiscountsExport'
export function OriginalFenixClientDiscountGrid({ result }: { result: FenixDiscountResult }) {
  const { t } = useI18n(), [page, setPage] = useState(0), shown = useMemo(() => fenixDiscountDisplayPage(result.Cells, page), [result.Cells, page])
  return <Stack gap="xs">
    <ReportTableScrollArea minWidth={1000}><Table className="app-static-table" striped><Table.Thead><Table.Tr>{fenixDiscountHeaders.map((header, index) => <Table.Th key={header} className={index === 3 ? 'app-table-cell-number' : undefined}>{t(header)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{shown.lines.map(line => <Table.Tr key={line.key}>{line.cells.map((cell, i) => <Table.Td key={`${i}:${fenixDiscountHeaders[i]}`} className={i === 3 ? 'app-table-cell-number' : undefined}>{cell}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
    </Table></ReportTableScrollArea>
    <ReportRowPagination total={shown.total} offset={shown.start} onChange={offset => setPage(offset / 50)} />{shown.total === 0 ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}</Stack>
}
