import { Fragment, type ReactNode } from 'react'
import { ActionIcon, Table } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import { flexRender, type Table as TableInstance } from '@tanstack/react-table'
import { getPinnedStyle } from './dataTablePinning'
import type { DataTableColumnMeta } from './types'

type DataTableExpandConfig<TData> = {
  canExpandRow: (row: TData) => boolean
  collapseLabel: string
  expandLabel: string
  isRowExpanded: (rowId: string) => boolean
  onToggleRow: (rowId: string) => void
  renderExpandedRow: (row: TData) => ReactNode
}

type DataTableBodyProps<TData> = {
  columnWidths: ReadonlyMap<string, number>
  expand?: DataTableExpandConfig<TData>
  fillColumnId?: string
  isLoading: boolean
  pinnedLeftOffset?: number
  table: TableInstance<TData>
  visibleColumnCount: number
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string | undefined
}

export function DataTableBody<TData>({
  columnWidths,
  expand,
  fillColumnId,
  isLoading,
  pinnedLeftOffset = 0,
  table,
  visibleColumnCount,
  onRowClick,
  rowClassName,
}: DataTableBodyProps<TData>) {
  const totalColumnCount = visibleColumnCount + (expand ? 1 : 0)

  if (isLoading) {
    return <Table.Tbody />
  }

  if (!table.getRowModel().rows.length) {
    return <Table.Tbody />
  }

  return (
    <Table.Tbody>
      {table.getRowModel().rows.map((row) => {
        const canExpand = expand ? expand.canExpandRow(row.original) : false
        const isExpanded = Boolean(expand && canExpand && expand.isRowExpanded(row.id))

        return (
          <Fragment key={row.id}>
            <Table.Tr
              className={`data-table-row ${rowClassName?.(row.original) ?? ''}`}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {expand ? (
                <Table.Td className="data-table-expand-cell">
                  {canExpand ? (
                    <ActionIcon
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? expand.collapseLabel : expand.expandLabel}
                      className="data-table-expand-toggle"
                      color="gray"
                      size="sm"
                      variant="subtle"
                      onClick={(event) => {
                        event.stopPropagation()
                        expand.onToggleRow(row.id)
                      }}
                    >
                      <IconChevronRight
                        size={16}
                        stroke={2}
                        style={{
                          transform: isExpanded ? 'rotate(90deg)' : undefined,
                          transition: 'transform 120ms ease',
                        }}
                      />
                    </ActionIcon>
                  ) : null}
                </Table.Td>
              ) : null}
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
                      ...getPinnedStyle(cell.column, 1, pinnedLeftOffset),
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
            {expand && isExpanded ? (
              <Table.Tr className="data-table-expanded-row">
                <Table.Td className="data-table-expanded-cell" colSpan={totalColumnCount}>
                  <div className="data-table-expanded-content">
                    {expand.renderExpandedRow(row.original)}
                  </div>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Fragment>
        )
      })}
    </Table.Tbody>
  )
}
