import { Fragment, memo, type CSSProperties, type ReactNode } from 'react'
import { ActionIcon, Table } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import { flexRender, type Cell, type Column, type Row, type Table as TableInstance } from '@tanstack/react-table'
import { getPinnedStyle } from './dataTablePinning'
import type { DataTableColumnMeta } from './types'

const SKELETON_ROW_COUNT = 9
const SKELETON_LINE_WIDTHS = ['78%', '62%', '46%', '70%', '54%', '84%', '58%', '38%'] as const

type DataTableExpandConfig<TData> = {
  canExpandRow: (row: TData) => boolean
  collapseLabel: string
  expandLabel: string
  onToggleRow: (rowId: string) => void
  renderExpandedRow: (row: TData) => ReactNode
}

type DataTableBodyProps<TData> = {
  columnWidths: ReadonlyMap<string, number>
  expand?: DataTableExpandConfig<TData>
  expandedRowIds?: ReadonlySet<string>
  fillerColumnWidth: number
  fillColumnId?: string
  isLoading: boolean
  pinnedLeftOffset?: number
  table: TableInstance<TData>
  visibleColumnCount: number
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string | undefined
}

type DataTableBodyRowProps<TData> = {
  columnWidths: ReadonlyMap<string, number>
  expand?: DataTableExpandConfig<TData>
  fillerColumnWidth: number
  fillColumnId?: string
  /* Boolean per row (not the whole Set) so toggling one row re-renders only it. */
  isExpanded: boolean
  pinnedLeftOffset: number
  row: Row<TData>
  totalColumnCount: number
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string | undefined
}

/* Row extracted and memoized: on large pages (500 rows × 30+ columns) the mount
   sequence re-renders the table several times (viewport width arriving, toolbar
   portal slot mounting, data landing) — without the memo every pass re-renders
   every cell, which reads as columns slowly "computing their widths". */
function DataTableBodyRowInner<TData>({
  columnWidths,
  expand,
  fillerColumnWidth,
  fillColumnId,
  isExpanded,
  pinnedLeftOffset,
  row,
  totalColumnCount,
  onRowClick,
  rowClassName,
}: DataTableBodyRowProps<TData>) {
  const canExpand = expand ? expand.canExpandRow(row.original) : false
  const { leading, rightPinned } = splitRightPinnedCells(row.getVisibleCells())

  function renderCell(cell: Cell<TData, unknown>) {
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
  }

  return (
    <Fragment>
      <Table.Tr
        className={`data-table-row ${rowClassName?.(row.original) ?? ''}`}
        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
      >
        {expand ? (
          <Table.Td
            className={`data-table-expand-cell ${canExpand ? 'is-expandable' : ''}`}
            onClick={canExpand
              ? (event) => {
                  event.stopPropagation()
                  expand.onToggleRow(row.id)
                }
              : undefined}
          >
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
                <ChevronRight
                  size={16}
                  strokeWidth={2}
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : undefined,
                    transition: 'transform 120ms ease',
                  }}
                />
              </ActionIcon>
            ) : null}
          </Table.Td>
        ) : null}
        {leading.map(renderCell)}
        {fillerColumnWidth > 0 ? (
          <Table.Td
            aria-hidden
            className="data-table-cell data-table-filler-cell"
            style={{ width: fillerColumnWidth, minWidth: fillerColumnWidth }}
          />
        ) : null}
        {rightPinned.map(renderCell)}
      </Table.Tr>
      {expand && canExpand && isExpanded ? (
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
}

const DataTableBodyRow = memo(DataTableBodyRowInner) as typeof DataTableBodyRowInner

export function DataTableBody<TData>({
  columnWidths,
  expand,
  expandedRowIds,
  fillerColumnWidth,
  fillColumnId,
  isLoading,
  pinnedLeftOffset = 0,
  table,
  visibleColumnCount,
  onRowClick,
  rowClassName,
}: DataTableBodyProps<TData>) {
  const hasFillerColumn = fillerColumnWidth > 0
  const totalColumnCount = visibleColumnCount + (expand ? 1 : 0) + (hasFillerColumn ? 1 : 0)

  if (isLoading) {
    const { leading, rightPinned } = splitRightPinnedColumns(table.getVisibleLeafColumns())

    return (
      <Table.Tbody aria-busy="true" className="data-table-skeleton-body">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
          <Table.Tr
            key={`loading-row-${rowIndex}`}
            className="data-table-row data-table-skeleton-row"
          >
            {expand ? (
              <Table.Td className="data-table-expand-cell data-table-skeleton-cell">
                <span className="data-table-skeleton-line data-table-skeleton-line-icon" />
              </Table.Td>
            ) : null}
            {leading.map((column, columnIndex) => {
              const meta = column.columnDef.meta as
                | DataTableColumnMeta
                | undefined
              const align = meta?.align ?? 'left'
              const columnWidth = columnWidths.get(column.id) ?? column.getSize()

              return (
                <Table.Td
                  key={column.id}
                  className={`data-table-cell data-table-skeleton-cell data-table-skeleton-cell-align-${align} ${meta?.className ?? ''}`}
                  style={{
                    ...getPinnedStyle(column, 1, pinnedLeftOffset),
                    width: columnWidth,
                    minWidth: column.columnDef.minSize,
                    maxWidth: column.id === fillColumnId ? undefined : column.columnDef.maxSize,
                    textAlign: align,
                  }}
                >
                  <span
                    className={`data-table-skeleton-line ${columnIndex === 0 ? 'data-table-skeleton-line-primary' : ''}`}
                    style={createSkeletonLineStyle(rowIndex, columnIndex)}
                  />
                </Table.Td>
              )
            })}
            {hasFillerColumn ? (
              <Table.Td
                aria-hidden
                className="data-table-cell data-table-filler-cell data-table-skeleton-cell"
                style={{ width: fillerColumnWidth, minWidth: fillerColumnWidth }}
              />
            ) : null}
            {rightPinned.map((column, columnIndex) => {
              const meta = column.columnDef.meta as
                | DataTableColumnMeta
                | undefined
              const align = meta?.align ?? 'left'
              const columnWidth = columnWidths.get(column.id) ?? column.getSize()
              const skeletonColumnIndex = leading.length + columnIndex

              return (
                <Table.Td
                  key={column.id}
                  className={`data-table-cell data-table-skeleton-cell data-table-skeleton-cell-align-${align} ${meta?.className ?? ''}`}
                  style={{
                    ...getPinnedStyle(column, 1, pinnedLeftOffset),
                    width: columnWidth,
                    minWidth: column.columnDef.minSize,
                    maxWidth: column.id === fillColumnId ? undefined : column.columnDef.maxSize,
                    textAlign: align,
                  }}
                >
                  <span
                    className={`data-table-skeleton-line ${skeletonColumnIndex === 0 ? 'data-table-skeleton-line-primary' : ''}`}
                    style={createSkeletonLineStyle(rowIndex, skeletonColumnIndex)}
                  />
                </Table.Td>
              )
            })}
          </Table.Tr>
        ))}
      </Table.Tbody>
    )
  }

  if (!table.getRowModel().rows.length) {
    return <Table.Tbody />
  }

  return (
    <Table.Tbody>
      {table.getRowModel().rows.map((row) => (
        <DataTableBodyRow
          key={row.id}
          columnWidths={columnWidths}
          expand={expand}
          fillerColumnWidth={fillerColumnWidth}
          fillColumnId={fillColumnId}
          isExpanded={Boolean(expand && expandedRowIds?.has(row.id))}
          pinnedLeftOffset={pinnedLeftOffset}
          row={row}
          totalColumnCount={totalColumnCount}
          onRowClick={onRowClick}
          rowClassName={rowClassName}
        />
      ))}
    </Table.Tbody>
  )
}

function splitRightPinnedCells<TData>(cells: Cell<TData, unknown>[]) {
  const leading: Cell<TData, unknown>[] = []
  const rightPinned: Cell<TData, unknown>[] = []

  cells.forEach((cell) => {
    if (cell.column.getIsPinned() === 'right') {
      rightPinned.push(cell)
    } else {
      leading.push(cell)
    }
  })

  return { leading, rightPinned }
}

function splitRightPinnedColumns<TData>(columns: Column<TData, unknown>[]) {
  const leading: Column<TData, unknown>[] = []
  const rightPinned: Column<TData, unknown>[] = []

  columns.forEach((column) => {
    if (column.getIsPinned() === 'right') {
      rightPinned.push(column)
    } else {
      leading.push(column)
    }
  })

  return { leading, rightPinned }
}

function createSkeletonLineStyle(rowIndex: number, columnIndex: number): CSSProperties {
  return {
    '--data-table-skeleton-width': SKELETON_LINE_WIDTHS[
      (rowIndex + columnIndex) % SKELETON_LINE_WIDTHS.length
    ],
  } as CSSProperties
}
