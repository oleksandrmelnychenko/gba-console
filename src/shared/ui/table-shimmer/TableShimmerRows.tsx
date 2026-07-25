import { Table } from '@mantine/core'
import './table-shimmer.css'

export function TableShimmerRows({
  columns,
  rows = 6,
}: {
  columns: number
  rows?: number
}) {
  return Array.from({ length: rows }, (_, rowIndex) => (
    <Table.Tr aria-hidden="true" className="app-table-shimmer-row" key={rowIndex}>
      {Array.from({ length: columns }, (_, columnIndex) => (
        <Table.Td key={columnIndex}>
          <span
            className="app-table-shimmer-line"
            style={{ width: `${46 + ((rowIndex + columnIndex) % 4) * 12}%` }}
          />
        </Table.Td>
      ))}
    </Table.Tr>
  ))
}
