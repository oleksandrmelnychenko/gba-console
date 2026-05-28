import type { Column } from '@tanstack/react-table'

export function getFillColumnId<TData>(
  columns: Column<TData, unknown>[],
  tableWidth: number,
  baseTableWidth: number,
) {
  if (tableWidth <= baseTableWidth) {
    return undefined
  }

  const stretchableColumns = columns.filter((column) => !column.getIsPinned())

  return stretchableColumns.at(-1)?.id
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
