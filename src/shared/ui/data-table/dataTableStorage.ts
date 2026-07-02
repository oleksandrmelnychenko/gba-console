import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  VisibilityState,
} from '@tanstack/react-table'
import type { DataTableDensity, DataTableDefaultLayout } from './types'

export type DataTableLayout = {
  version?: string
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  columnPinning?: ColumnPinningState
  columnSizing?: ColumnSizingState
  density?: DataTableDensity
}

const STORAGE_PREFIX = 'gba-data-table'

export type NormalizedDataTableLayout = {
  columnOrder: ColumnOrderState
  columnVisibility: VisibilityState
  columnPinning: ColumnPinningState
  columnSizing: ColumnSizingState
  density: DataTableDensity
}

function getDataTableStorageKey(tableId: string) {
  return `${STORAGE_PREFIX}:${tableId}:layout`
}

export function readDataTableLayout(tableId: string): DataTableLayout {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const value = window.localStorage.getItem(getDataTableStorageKey(tableId))
    return value ? (JSON.parse(value) as DataTableLayout) : {}
  } catch {
    return {}
  }
}

export function writeDataTableLayout(tableId: string, layout: DataTableLayout) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(getDataTableStorageKey(tableId), JSON.stringify(layout))
}

export function clearDataTableLayout(tableId: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(getDataTableStorageKey(tableId))
}

function normalizeColumnOrder(
  columnIds: string[],
  order?: ColumnOrderState,
  defaultOrder?: ColumnOrderState,
) {
  const knownColumns = new Set(columnIds)
  const savedOrder = (order ?? []).filter((columnId) => knownColumns.has(columnId))
  const savedColumns = new Set(savedOrder)
  const missingColumns = columnIds.filter((columnId) => !savedColumns.has(columnId))
  const fallbackOrder = [
    ...(defaultOrder ?? []).filter((columnId) => knownColumns.has(columnId)),
    ...columnIds.filter((columnId) => !(defaultOrder ?? []).includes(columnId)),
  ]
  const orderIndex = new Map(fallbackOrder.map((columnId, index) => [columnId, index]))
  const missingByFallbackOrder = missingColumns.toSorted(
    (left, right) =>
      (orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER),
  )
  const normalizedOrder: ColumnOrderState = []
  let missingIndex = 0

  for (const columnId of savedOrder) {
    const currentOrderIndex = orderIndex.get(columnId) ?? Number.MAX_SAFE_INTEGER

    while (missingIndex < missingByFallbackOrder.length) {
      const missingColumnId = missingByFallbackOrder[missingIndex]
      const missingOrderIndex = orderIndex.get(missingColumnId) ?? Number.MAX_SAFE_INTEGER

      if (missingOrderIndex > currentOrderIndex) {
        break
      }

      normalizedOrder.push(missingColumnId)
      missingIndex += 1
    }

    normalizedOrder.push(columnId)
  }

  while (missingIndex < missingByFallbackOrder.length) {
    normalizedOrder.push(missingByFallbackOrder[missingIndex])
    missingIndex += 1
  }

  return normalizedOrder
}

function normalizeColumnVisibility(
  columnIds: string[],
  visibility?: VisibilityState,
) {
  const knownColumns = new Set(columnIds)
  const entries = Object.entries(visibility ?? {}).filter(([columnId]) =>
    knownColumns.has(columnId),
  )

  return Object.fromEntries(entries) as VisibilityState
}

function normalizeColumnSizing(columnIds: string[], sizing?: ColumnSizingState) {
  const knownColumns = new Set(columnIds)
  const entries = Object.entries(sizing ?? {}).filter(([columnId]) =>
    knownColumns.has(columnId),
  )

  return Object.fromEntries(entries) as ColumnSizingState
}

function normalizeColumnPinning(
  columnIds: string[],
  pinning?: ColumnPinningState,
) {
  const knownColumns = new Set(columnIds)

  return {
    left: (pinning?.left ?? []).filter((columnId) => knownColumns.has(columnId)),
    right: (pinning?.right ?? []).filter((columnId) => knownColumns.has(columnId)),
  } satisfies ColumnPinningState
}

export function normalizeDataTableLayout(
  layout: DataTableLayout,
  columnIds: string[],
  defaultLayout?: DataTableDefaultLayout,
): NormalizedDataTableLayout {
  return {
    columnOrder: normalizeColumnOrder(
      columnIds,
      layout.columnOrder ?? defaultLayout?.columnOrder,
      defaultLayout?.columnOrder,
    ),
    columnVisibility: normalizeColumnVisibility(
      columnIds,
      layout.columnVisibility ?? defaultLayout?.columnVisibility,
    ),
    columnPinning: normalizeColumnPinning(
      columnIds,
      layout.columnPinning ?? defaultLayout?.columnPinning,
    ),
    columnSizing: normalizeColumnSizing(
      columnIds,
      layout.columnSizing ?? defaultLayout?.columnSizing,
    ),
    density: normalizeDensity(layout.density ?? defaultLayout?.density),
  }
}

export function createDefaultDataTableLayout(
  columnIds: string[],
  defaultLayout?: DataTableDefaultLayout,
): NormalizedDataTableLayout {
  return normalizeDataTableLayout({}, columnIds, defaultLayout)
}

function normalizeDensity(density?: DataTableDensity): DataTableDensity {
  return density === 'compact' ? 'compact' : 'normal'
}
