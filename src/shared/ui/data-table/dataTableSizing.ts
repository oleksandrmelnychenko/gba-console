import type { Column } from '@tanstack/react-table'
import type { DataTableColumnMeta } from './types'

export function getFillColumnId<TData>(
  columns: Column<TData, unknown>[],
  tableWidth: number,
  baseTableWidth: number,
) {
  if (tableWidth <= baseTableWidth) {
    return undefined
  }

  // A column may opt in as the fill target via meta.fill even when pinned;
  // otherwise the last non-pinned column absorbs the extra width.
  const preferred = columns.find(
    (column) => (column.columnDef.meta as DataTableColumnMeta | undefined)?.fill,
  )
  const stretchableColumns = columns.filter((column) => !column.getIsPinned())

  return (preferred ?? stretchableColumns.at(-1))?.id
}

export function createRenderedColumnWidths<TData>(
  columns: Column<TData, unknown>[],
  fillColumnId: string | undefined,
  fillColumnExtraWidth: number,
) {
  const widths = new Map<string, number>()

  columns.forEach((column) => {
    widths.set(
      column.id,
      column.getSize() + (column.id === fillColumnId ? fillColumnExtraWidth : 0),
    )
  })

  return widths
}
