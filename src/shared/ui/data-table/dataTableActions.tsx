import type { ColumnPinningState } from '@tanstack/react-table'
import type { DataTableColumn } from './types'

const ACTION_COLUMN_ID_PATTERN =
  /^(?:(?:.+)Action|actions|operations?|controls?|edit|delete|remove|archive|view|open|process|print|cancel|reassign|menu)$/i

// Row actions are 24px icons (--app-control-height-xs) in a cell with 8px
// inline padding, so one action needs 40px, two 68px, three 96px.
const ACTION_ICON_SIZE = 24
const ACTION_GAP = 4
const ACTION_CELL_INLINE_PADDING = 16
const MIN_ACTION_COLUMN_WIDTH = 40
const ACTION_CONTROL_SELECTOR = 'button, a[href], [role="button"], input, .mantine-ActionIcon-root'

// Share of rows whose actions must fit on one line. A rare row with more
// actions (e.g. one advance report among 40 payments) wraps its icons onto a
// second line instead of widening the column for every row.
const ACTION_FIT_ROW_SHARE = 0.8

/**
 * Width an action column needs for what it actually renders: the horizontal
 * span of the controls in its body cells (80th percentile over rows, so the
 * typical row fits on one line) plus the cell's inline padding. Returns null
 * when nothing measurable is rendered (no rows, jsdom).
 */
export function measureActionColumnFitWidth(
  root: ParentNode,
  columnId: string,
): number | null {
  const cells = root.querySelectorAll<HTMLElement>(
    `td[data-column-id="${CSS.escape(columnId)}"]`,
  )
  const spans: number[] = []
  let inlinePadding = ACTION_CELL_INLINE_PADDING

  cells.forEach((cell) => {
    // Use the cell's real padding (some pages pad their actions column).
    const style = getComputedStyle(cell)
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    if (Number.isFinite(padding) && padding > 0) inlinePadding = padding

    const controls = Array.from(cell.querySelectorAll<HTMLElement>(ACTION_CONTROL_SELECTOR))
      .map((control) => control.getBoundingClientRect())
      .filter((rect) => rect.width > 0)

    if (controls.length === 0) return

    // Controls may already wrap onto several lines: measure the widest line.
    const lines = new Map<number, DOMRect[]>()
    controls.forEach((rect) => {
      const key = Math.round(rect.top)
      lines.set(key, [...(lines.get(key) ?? []), rect])
    })
    const span = Math.max(
      ...Array.from(lines.values()).map((line) =>
        Math.max(...line.map((rect) => rect.right)) - Math.min(...line.map((rect) => rect.left)),
      ),
    )
    spans.push(span)
  })

  if (spans.length === 0) return null

  spans.sort((a, b) => a - b)
  const span = spans[Math.min(spans.length - 1, Math.ceil(spans.length * ACTION_FIT_ROW_SHARE) - 1)]

  if (span <= 0) return null

  return Math.max(MIN_ACTION_COLUMN_WIDTH, Math.ceil(span + inlinePadding))
}

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
