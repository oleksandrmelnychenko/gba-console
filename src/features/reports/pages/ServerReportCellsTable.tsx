import { Table } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'

type DisplayColumn = { Key: string; Caption: string }
type DisplayCell = { Key: string; Available: boolean; Value: string | null; FormattedValue: string | null }

/** Displays ordered scalar cells exactly as formatted by the report server. */
export function ServerReportCellsTable({ columns, cells }: {
  columns: readonly DisplayColumn[]; cells: readonly DisplayCell[]
}) {
  const { t } = useI18n()
  return <Table.ScrollContainer minWidth={640}>
    <Table>
      <Table.Thead><Table.Tr>{columns.map(column => <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
      <Table.Tbody><Table.Tr>{cells.map(cell => <Table.Td key={cell.Key}
        title={!cell.Available ? t('Недоступні дані') : cell.Value === null ? t('У періоді немає даних') : undefined}>
        {cell.FormattedValue ?? '—'}
      </Table.Td>)}</Table.Tr></Table.Tbody>
    </Table>
  </Table.ScrollContainer>
}
