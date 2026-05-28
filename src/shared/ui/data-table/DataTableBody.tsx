import type { ReactNode } from 'react'
import { Group, Loader, Table } from '@mantine/core'
import { flexRender, type Table as TableInstance } from '@tanstack/react-table'
import { getPinnedStyle } from './dataTablePinning'
import type { DataTableColumnMeta, DataTableLabels } from './types'

type DataTableBodyProps<TData> = {
  columnWidths: ReadonlyMap<string, number>
  emptyText?: ReactNode
  fillColumnId?: string
  isLoading: boolean
  labels: Required<DataTableLabels>
  loadingText?: ReactNode
  table: TableInstance<TData>
  visibleColumnCount: number
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string | undefined
}

export function DataTableBody<TData>({
  columnWidths,
  emptyText,
  fillColumnId,
  isLoading,
  labels,
  loadingText,
  table,
  visibleColumnCount,
  onRowClick,
  rowClassName,
}: DataTableBodyProps<TData>) {
  if (isLoading) {
    return (
      <Table.Tbody>
        <Table.Tr>
          <Table.Td className="data-table-empty" colSpan={visibleColumnCount}>
            <Group gap={8} justify="center">
              <Loader color="violet" size="sm" />
              <span>{loadingText ?? labels.loadingData}</span>
            </Group>
          </Table.Td>
        </Table.Tr>
      </Table.Tbody>
    )
  }

  if (!table.getRowModel().rows.length) {
    return (
      <Table.Tbody>
        <Table.Tr>
          <Table.Td className="data-table-empty" colSpan={visibleColumnCount}>
            {emptyText ?? labels.noData}
          </Table.Td>
        </Table.Tr>
      </Table.Tbody>
    )
  }

  return (
    <Table.Tbody>
      {table.getRowModel().rows.map((row) => (
        <Table.Tr
          key={row.id}
          className={`data-table-row ${rowClassName?.(row.original) ?? ''}`}
          onClick={onRowClick ? () => onRowClick(row.original) : undefined}
        >
          {row.getVisibleCells().map((cell) => {
            const meta = cell.column.columnDef.meta as
              | DataTableColumnMeta
              | undefined
            const columnWidth = columnWidths.get(cell.column.id) ?? cell.column.getSize()

            return (
              <Table.Td
                key={cell.id}
                className={`data-table-cell ${meta?.className ?? ''}`}
                style={{
                  ...getPinnedStyle(cell.column, 1),
                  width: columnWidth,
                  minWidth: cell.column.columnDef.minSize,
                  maxWidth: cell.column.id === fillColumnId ? undefined : cell.column.columnDef.maxSize,
                  textAlign: meta?.align ?? 'left',
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Table.Td>
            )
          })}
        </Table.Tr>
      ))}
    </Table.Tbody>
  )
}
