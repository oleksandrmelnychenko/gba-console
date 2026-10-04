import { Button, Group, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
type SalesGridLine = { key: string; cells: string[]; subtotal: boolean }
export function OriginalSalesGrid({ lines, headers, totals, hierarchyColumns = 2 }: { lines: SalesGridLine[]; headers: string[]; totals: string[] | null; hierarchyColumns?: 2 | 3 | 4 }) {
  const { t } = useI18n(), [page, setPage] = useState(0)
  const current = Math.min(page, Math.max(0, Math.ceil(lines.length / 50) - 1)), start = current * 50
  return <Stack gap="xs"><Group><Button variant="light" disabled={!current} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text>{lines.length ? start + 1 : 0}–{Math.min(lines.length, start + 50)} / {lines.length}</Text>
    <Button variant="light" disabled={start + 50 >= lines.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={1000}><Table striped><Table.Thead><Table.Tr>{headers.map((h, i) => <Table.Th key={`${i}:${h}`}>{t(h)}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody>{lines.slice(start, start + 50).map(line => <Table.Tr key={line.key} fw={line.subtotal ? 600 : undefined}>
        {line.cells.map((cell, i) => <Table.Td key={`${i}:${headers[i]}`} className={i >= hierarchyColumns ? 'app-money' : undefined}>{cell}</Table.Td>)}
      </Table.Tr>)}</Table.Tbody>{totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={hierarchyColumns}>{t('Разом')}</Table.Th>
        {totals.map((cell, i) => <Table.Td key={`${i}:${headers[i + hierarchyColumns]}`} className="app-money">{cell}</Table.Td>)}
      </Table.Tr></Table.Tfoot> : null}</Table></Table.ScrollContainer>{!lines.length ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}</Stack>
}
