import { Button, Group, Stack, Table, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { FenixDiscountResult } from '../data/originalFenixClientDiscounts'
import { fenixDiscountDisplayPage } from '../data/originalFenixClientDiscountDisplay'
import { fenixDiscountHeaders } from '../data/originalFenixClientDiscountsExport'
export function OriginalFenixClientDiscountGrid({ result }: { result: FenixDiscountResult }) {
  const { t } = useI18n(), [page, setPage] = useState(0), shown = useMemo(() => fenixDiscountDisplayPage(result.Cells, page), [result.Cells, page])
  return <Stack gap="xs"><Group><Button variant="light" disabled={shown.current === 0} onClick={() => setPage(shown.current - 1)}>{t('Попередні рядки')}</Button>
    <Text>{shown.total ? shown.start + 1 : 0}–{Math.min(shown.total, shown.start + 50)} / {shown.total}</Text>
    <Button variant="light" disabled={shown.start + 50 >= shown.total} onClick={() => setPage(shown.current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1000}><Table striped><Table.Thead><Table.Tr>{fenixDiscountHeaders.map(header => <Table.Th key={header}>{t(header)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{shown.lines.map(line => <Table.Tr key={line.key}>{line.cells.map((cell, i) => <Table.Td key={`${i}:${fenixDiscountHeaders[i]}`} className={i === 3 ? 'app-money' : undefined}>{cell}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
    </Table></Table.ScrollContainer>{shown.total === 0 ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}</Stack>
}
