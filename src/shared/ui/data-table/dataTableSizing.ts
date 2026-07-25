import type { Column, ColumnSizingState } from '@tanstack/react-table'
import type { DataTableColumnMeta } from './types'

type RenderedColumnSizingOptions = {
  distributeAvailableWidth?: boolean
  excludedColumnIds?: ReadonlySet<string>
}

export function getFillColumnId<TData>(
  columns: Column<TData, unknown>[],
  tableWidth: number,
  baseTableWidth: number,
  options?: RenderedColumnSizingOptions,
) {
  if (tableWidth <= baseTableWidth) {
    return undefined
  }

  // A column may opt in as the fill target via meta.fill even when pinned.
  const preferred = columns.find(
    (column) =>
      !options?.excludedColumnIds?.has(column.id) &&
      (column.columnDef.meta as DataTableColumnMeta | undefined)?.fill,
  )

  if (preferred) {
    return preferred.id
  }

  if (options?.distributeAvailableWidth) {
    return undefined
  }

  const stretchableColumns = columns.filter(
    (column) =>
      !column.getIsPinned() &&
      !options?.excludedColumnIds?.has(column.id),
  )

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
  options?: RenderedColumnSizingOptions,
) {
  const widths = new Map<string, number>()
  const distributedColumns =
    options?.distributeAvailableWidth && !fillColumnId && fillColumnExtraWidth > 0
      ? columns.filter(
          (column) =>
            !column.getIsPinned() &&
            !options.excludedColumnIds?.has(column.id),
        )
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

/**
 * TanStack resizes against the configured (base) width, while a fill column is
 * rendered wider than that base. Translate the resize result back to the width
 * the user actually grabbed so the auto-fill delta cannot cancel the drag.
 */
export function preserveRenderedColumnResize(
  nextSizing: ColumnSizingState,
  baseWidths: ReadonlyMap<string, number>,
  renderedWidths: ReadonlyMap<string, number>,
): ColumnSizingState {
  let adjustedSizing: ColumnSizingState | undefined

  Object.entries(nextSizing).forEach(([columnId, nextBaseWidth]) => {
    const currentBaseWidth = baseWidths.get(columnId)
    const currentRenderedWidth = renderedWidths.get(columnId)

    if (
      currentBaseWidth === undefined ||
      currentRenderedWidth === undefined ||
      nextBaseWidth === currentBaseWidth
    ) {
      return
    }

    const autoFillWidth = Math.max(0, currentRenderedWidth - currentBaseWidth)

    if (autoFillWidth === 0) {
      return
    }

    adjustedSizing ??= { ...nextSizing }
    adjustedSizing[columnId] = Math.round(nextBaseWidth + autoFillWidth)
  })

  return adjustedSizing ?? nextSizing
}

export function getManuallySizedColumnIds(
  columnSizing: ColumnSizingState,
  defaultColumnSizing: ColumnSizingState = {},
): ReadonlySet<string> {
  return new Set(
    Object.entries(columnSizing)
      .filter(([columnId, width]) => defaultColumnSizing[columnId] !== width)
      .map(([columnId]) => columnId),
  )
}
