import type { Column } from '@tanstack/react-table'
import type { DataTableColumnMeta } from './types'

export function getFillColumnId<TData>(
  columns: Column<TData, unknown>[],
  tableWidth: number,
  baseTableWidth: number,
  options?: { distributeAvailableWidth?: boolean },
) {
  if (tableWidth <= baseTableWidth) {
    return undefined
  }

  // A column may opt in as the fill target via meta.fill even when pinned.
  const preferred = columns.find(
    (column) => (column.columnDef.meta as DataTableColumnMeta | undefined)?.fill,
  )

  if (preferred) {
    return preferred.id
  }

  if (options?.distributeAvailableWidth) {
    return undefined
  }

  const stretchableColumns = columns.filter((column) => !column.getIsPinned())

  if (stretchableColumns.length === 0) {
    return undefined
  }

  // Prefer data columns (sortable ⇒ they have an accessor) so the extra width
  // lands on a real content column, not on an actions/index/checkbox column.
  const dataColumns = stretchableColumns.filter((column) => column.getCanSort())
  const pool = dataColumns.length > 0 ? dataColumns : stretchableColumns

  // The widest column in the pool (usually the name/description column) absorbs
  // the extra width, so the table fills its container without dead space.
  return pool.reduce((widest, column) =>
    column.getSize() > widest.getSize() ? column : widest,
  ).id
}

export function createRenderedColumnWidths<TData>(
  columns: Column<TData, unknown>[],
  fillColumnId: string | undefined,
  fillColumnExtraWidth: number,
  options?: { distributeAvailableWidth?: boolean },
) {
  const widths = new Map<string, number>()
  const distributedColumns =
    options?.distributeAvailableWidth && !fillColumnId && fillColumnExtraWidth > 0
      ? columns.filter((column) => !column.getIsPinned())
      : []
  const distributedExtraWidth =
    distributedColumns.length > 0 ? fillColumnExtraWidth / distributedColumns.length : 0

  columns.forEach((column) => {
    const columnExtraWidth =
      column.id === fillColumnId
        ? fillColumnExtraWidth
        : distributedColumns.includes(column)
          ? distributedExtraWidth
          : 0

    widths.set(
      column.id,
      Math.round(column.getSize() + columnExtraWidth),
    )
  })

  return widths
}
