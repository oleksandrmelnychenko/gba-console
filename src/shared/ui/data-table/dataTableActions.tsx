import type { ColumnPinningState } from '@tanstack/react-table'
import type { DataTableColumn } from './types'

const ACTION_COLUMN_ID_PATTERN =
  /^(?:(?:.+)Action|actions|operations?|controls?|edit|delete|remove|archive|view|open|process|print|cancel|reassign|menu)$/i

const ACTION_ICON_SIZE = 28
const ACTION_GAP = 4
const ACTION_CELL_INLINE_PADDING = 16
const MIN_ACTION_COLUMN_WIDTH = 56

export function isDataTableActionColumn<TData>(
  column: DataTableColumn<TData>,
): boolean {
  return column.rowActions === true || ACTION_COLUMN_ID_PATTERN.test(column.id)
}

export function prepareDataTableColumns<TData>(
  columns: DataTableColumn<TData>[],
): DataTableColumn<TData>[] {
  const actionColumns = columns.filter(isDataTableActionColumn)

  if (actionColumns.length === 0) {
    return columns
  }

  if (actionColumns.length === 1) {
    const actionColumn = actionColumns[0]

    return columns.map((column) =>
      column === actionColumn ? normalizeActionColumn(actionColumn) : column,
    )
  }

  const mergedColumnId = 'actions'
  const firstActionIndex = columns.findIndex(isDataTableActionColumn)
  const mergedWidth = Math.max(
    MIN_ACTION_COLUMN_WIDTH,
    ACTION_CELL_INLINE_PADDING +
      actionColumns.length * ACTION_ICON_SIZE +
      (actionColumns.length - 1) * ACTION_GAP,
  )
  const mergedColumn: DataTableColumn<TData> = {
    id: mergedColumnId,
    header: '',
    width: mergedWidth,
    minWidth: mergedWidth,
    maxWidth: mergedWidth,
    align: 'center',
    className: 'data-table-actions-column',
    rowActions: true,
    enableSorting: false,
    enableHiding: false,
    enablePinning: false,
    enableReorder: false,
    enableResizing: false,
    cell: (row) => (
      <div className="data-table-row-actions">
        {actionColumns.map((column) => (
          <div className="data-table-row-action-slot" key={column.id}>
            {column.cell ? column.cell(row) : null}
          </div>
        ))}
      </div>
    ),
  }
  const regularColumns = columns.filter(
    (column) => !isDataTableActionColumn(column),
  )

  regularColumns.splice(firstActionIndex, 0, mergedColumn)

  return regularColumns
}

export function getDataTableActionColumnIds<TData>(
  columns: DataTableColumn<TData>[],
): string[] {
  return columns
    .filter(isDataTableActionColumn)
    .map((column) => column.id)
}

export function pinDataTableActionsRight(
  pinning: ColumnPinningState,
  actionColumnIds: string[],
): ColumnPinningState {
  if (actionColumnIds.length === 0) {
    return pinning
  }

  const actionIds = new Set(actionColumnIds)
  const left = (pinning.left ?? []).filter((columnId) => !actionIds.has(columnId))
  const right = [
    ...(pinning.right ?? []).filter((columnId) => !actionIds.has(columnId)),
    ...actionColumnIds,
  ]

  return { left, right }
}

function normalizeActionColumn<TData>(
  column: DataTableColumn<TData>,
): DataTableColumn<TData> {
  return {
    ...column,
    header: '',
    align: 'center',
    className: joinClassNames(column.className, 'data-table-actions-column'),
    rowActions: true,
    enableSorting: false,
    enableHiding: false,
    enablePinning: false,
    enableReorder: false,
    enableResizing: false,
  }
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}
