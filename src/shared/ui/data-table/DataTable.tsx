import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Table } from '@mantine/core'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type Header,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { DataTableBody } from './DataTableBody'
import {
  clearDataTableLayout,
  createDefaultDataTableLayout,
  normalizeDataTableLayout,
  readDataTableLayout,
  writeDataTableLayout,
  type NormalizedDataTableLayout,
} from './dataTableStorage'
import { DataTableHeaderCell } from './DataTableHeaderCell'
import { createRenderedColumnWidths, getFillColumnId } from './dataTableSizing'
import { DataTableToolbar } from './DataTableToolbar'
import { createPortal } from 'react-dom'
import { useElementClientWidth } from './useElementClientWidth'
import { useI18n } from '../../i18n/useI18n'
import type { TranslateFunction } from '../../i18n/types'
import type {
  DataTableColumnMeta,
  DataTableExpandColumnLabels,
  DataTableLabels,
  DataTableProps,
} from './types'
import './data-table.css'

const EXPAND_COLUMN_WIDTH = 40
// Module-level sensor options keep useSensor/useSensors memoization intact
// (inline literals re-created the descriptors on every render).
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 6 } }
const KEYBOARD_SENSOR_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates }

export function DataTable<TData>({
  columns,
  data,
  tableId,
  defaultLayout,
  layoutVersion,
  getRowId,
  isLoading = false,
  minWidth = 960,
  fillAvailableWidth = false,
  distributeAvailableWidth = false,
  height,
  maxHeight,
  emptyText,
  labels: labelsOverride,
  showLayoutControls = false,
  enablePinning = true,
  showDensityToggle = true,
  density: controlledDensity,
  onDensityChange,
  toolbarLeft,
  toolbarRight,
  footer,
  toolbarPortalTarget,
  onRowClick,
  rowClassName,
  manualSorting = false,
  sorting: controlledSorting,
  onSortingChange,
  renderExpandedRow,
  getRowCanExpand,
  expandColumnLabels,
}: DataTableProps<TData>) {
  const { t } = useI18n()
  const isExpandable = Boolean(renderExpandedRow)
  const expandLabels = useMemo(
    () => createExpandColumnLabels(t, expandColumnLabels),
    [expandColumnLabels, t],
  )
  const [expandedRowIds, setExpandedRowIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const toggleExpandedRow = useCallback((rowId: string) => {
    setExpandedRowIds((current) => {
      const next = new Set(current)

      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }

      return next
    })
  }, [])
  const labels = useMemo(
    () => ({ ...createDefaultLabels(t), ...labelsOverride }),
    [labelsOverride, t],
  )
  const effectiveDefaultLayout = useMemo(
    () =>
      enablePinning
        ? defaultLayout
        : {
            ...defaultLayout,
            columnPinning: { left: [], right: [] },
          },
    [defaultLayout, enablePinning],
  )
  const normalizedLayoutVersion = normalizeLayoutVersion(layoutVersion)
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns])
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const sorting = controlledSorting ?? internalSorting
  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null)
  const scrollViewportWidth = useElementClientWidth(scrollNode)
  const [layout, setLayout] = useState<NormalizedDataTableLayout>(() =>
    normalizeDataTableLayout(
      readCompatibleDataTableLayout(tableId, normalizedLayoutVersion),
      columnIds,
      effectiveDefaultLayout,
    ),
  )
  const columnSignature = useMemo(() => columnIds.join('::'), [columnIds])
  // Re-sync the layout when the version or column set changes (the useState
  // initializer only runs on the first mount, so an HMR/config change would
  // otherwise keep serving the stale layout). Safe against the old
  // "stale layout stamped with the new version" corruption because persistence
  // is write-through on user actions only — this effect never writes storage.
  useEffect(() => {
    setLayout((currentLayout) => {
      const nextLayout = normalizeDataTableLayout(
        readCompatibleDataTableLayout(tableId, normalizedLayoutVersion),
        columnIds,
        effectiveDefaultLayout,
      )

      // On a plain mount this recomputes exactly what the useState initializer
      // produced — returning the current object skips a full-table re-render
      // (visible as columns "re-measuring" right after the screen loads).
      return JSON.stringify(nextLayout) === JSON.stringify(currentLayout)
        ? currentLayout
        : nextLayout
    })
    // effectiveDefaultLayout is intentionally keyed by layoutVersion; depending on its
    // object identity would reset pages that build it inline on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSignature, normalizedLayoutVersion, tableId])
  const normalizedLayout = useMemo(
    () => normalizeDataTableLayout(layout, columnIds, effectiveDefaultLayout),
    [columnIds, effectiveDefaultLayout, layout],
  )

  const columnTitles = useMemo(() => {
    return new Map(
      columns.map((column) => [
        column.id,
        typeof column.header === 'string' ? t(column.header) : column.id,
      ]),
    )
  }, [columns, t])

  const tableColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    return columns.map((column): ColumnDef<TData, unknown> => {
      const meta: DataTableColumnMeta = {
        align: column.align ?? 'left',
        className: column.className,
        enableReorder: column.enableReorder !== false,
        fill: column.fill,
      }

      return {
        id: column.id,
        header: () => (typeof column.header === 'string' ? t(column.header) : column.header),
        accessorFn: column.accessor ?? (() => null),
        cell: (context) =>
          column.cell
            ? column.cell(context.row.original)
            : formatCellValue(context.getValue(), labels),
        enableHiding: column.enableHiding !== false,
        enablePinning: enablePinning && column.enablePinning !== false,
        enableResizing: column.enableResizing !== false,
        enableSorting: column.enableSorting ?? Boolean(column.accessor),
        maxSize: column.maxWidth,
        meta,
        minSize: column.minWidth,
        size: column.width,
      }
    })
  }, [columns, enablePinning, labels, t])

  // Persist write-through on USER changes only. A watch-effect used to mirror the
  // layout state into storage, but on a layoutVersion bump it raced the reset
  // effect and stamped the STALE layout with the new version — permanently
  // blocking the new defaults from ever applying.
  function updateLayout(
    updater: (currentLayout: NormalizedDataTableLayout) => NormalizedDataTableLayout,
  ) {
    setLayout((currentLayout) => {
      const nextLayout = normalizeDataTableLayout(
        updater(normalizeDataTableLayout(currentLayout, columnIds, effectiveDefaultLayout)),
        columnIds,
        effectiveDefaultLayout,
      )

      writeDataTableLayout(tableId, { ...nextLayout, version: normalizedLayoutVersion })

      return nextLayout
    })
  }

  const handleColumnOrderChange: OnChangeFn<ColumnOrderState> = (updater) => {
    updateLayout((currentLayout) => ({
      ...currentLayout,
      columnOrder: resolveStateUpdater(updater, currentLayout.columnOrder),
    }))
  }

  const handleColumnVisibilityChange: OnChangeFn<VisibilityState> = (updater) => {
    updateLayout((currentLayout) => ({
      ...currentLayout,
      columnVisibility: resolveStateUpdater(
        updater,
        currentLayout.columnVisibility,
      ),
    }))
  }

  const handleColumnPinningChange: OnChangeFn<ColumnPinningState> = (updater) => {
    updateLayout((currentLayout) => ({
      ...currentLayout,
      columnPinning: resolveStateUpdater(updater, currentLayout.columnPinning),
    }))
  }

  const handleColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    updateLayout((currentLayout) => ({
      ...currentLayout,
      columnSizing: resolveStateUpdater(updater, currentLayout.columnSizing),
    }))
  }

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const nextSorting = resolveStateUpdater(updater, sorting)

    if (!controlledSorting) {
      setInternalSorting(nextSorting)
    }

    onSortingChange?.(nextSorting)
  }

  function handleDensityChange(density: NormalizedDataTableLayout['density']) {
    if (onDensityChange) {
      onDensityChange(density)
      return
    }

    updateLayout((currentLayout) => ({
      ...currentLayout,
      density,
    }))
  }

  const effectiveDensity = controlledDensity ?? normalizedLayout.density

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns: tableColumns,
    data,
    defaultColumn: {
      maxSize: 640,
      minSize: 72,
      size: 160,
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    manualSorting,
    enableColumnPinning: true,
    enableColumnResizing: true,
    // 'onEnd': applying the width only on mouseup avoids a full-table re-render
    // (and a synchronous localStorage write) per mousemove during a resize drag.
    columnResizeMode: 'onEnd',
    onColumnOrderChange: handleColumnOrderChange,
    onColumnPinningChange: handleColumnPinningChange,
    onColumnSizingChange: handleColumnSizingChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onSortingChange: handleSortingChange,
    state: {
      columnOrder: normalizedLayout.columnOrder,
      columnPinning: normalizedLayout.columnPinning,
      columnSizing: normalizedLayout.columnSizing,
      columnVisibility: normalizedLayout.columnVisibility,
      sorting,
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  )
  // Signals every header/toolbar menu to close as soon as a column drag starts —
  // an open portal dropdown would otherwise hang detached while its column moves.
  const [isColumnDragActive, setIsColumnDragActive] = useState(false)

  const expandColumnWidth = isExpandable ? EXPAND_COLUMN_WIDTH : 0
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const headerGroups = table.getHeaderGroups()
  const firstHeaderGroupColumns = splitRightPinnedHeaders(headerGroups[0]?.headers ?? [])
  const baseTableWidth = table.getTotalSize() + expandColumnWidth
  const shouldFillAvailableWidth = fillAvailableWidth || distributeAvailableWidth
  const tableWidth = Math.ceil(
    Math.max(
      minWidth + expandColumnWidth,
      baseTableWidth,
      scrollViewportWidth,
    ),
  )
  const fillerColumnWidth = shouldFillAvailableWidth ? 0 : Math.max(0, tableWidth - baseTableWidth)
  const renderedColumnTableWidth = shouldFillAvailableWidth ? tableWidth : baseTableWidth
  // Memoized so the widths Map keeps its identity across unrelated re-renders —
  // it is a prop of every (memoized) body row.
  const { columnWidths, fillColumnId } = useMemo(() => {
    const fillId = getFillColumnId(visibleLeafColumns, renderedColumnTableWidth, baseTableWidth, {
      distributeAvailableWidth,
    })

    return {
      columnWidths: createRenderedColumnWidths(
        visibleLeafColumns,
        fillId,
        renderedColumnTableWidth - baseTableWidth,
        { distributeAvailableWidth },
      ),
      fillColumnId: fillId,
    }
  }, [baseTableWidth, distributeAvailableWidth, renderedColumnTableWidth, visibleLeafColumns])
  const visibleColumnCount = visibleLeafColumns.length || 1
  const scrollStyle = useMemo(
    () => createScrollStyle(height, maxHeight, scrollViewportWidth > 0),
    [height, maxHeight, scrollViewportWidth],
  )
  const normalizedEmptyText = typeof emptyText === 'string' ? t(emptyText) : emptyText
  const isEmpty = !isLoading && table.getRowModel().rows.length === 0

  // Identity-stable expand config: pages typically pass renderExpandedRow /
  // getRowCanExpand as inline arrows, and expandedRowIds changes per toggle —
  // depending on either would hand every memoized body row a fresh `expand`
  // prop (all rows re-render on any page render / any single-row toggle).
  // The callbacks are read through refs; the expanded set is passed to the
  // body separately so only the toggled row's `isExpanded` prop changes.
  const renderExpandedRowRef = useRef(renderExpandedRow)
  renderExpandedRowRef.current = renderExpandedRow
  const getRowCanExpandRef = useRef(getRowCanExpand)
  getRowCanExpandRef.current = getRowCanExpand
  const expandConfig = useMemo(
    () =>
      isExpandable
        ? {
            canExpandRow: (row: TData) => getRowCanExpandRef.current?.(row) ?? true,
            collapseLabel: expandLabels.collapseRow,
            expandLabel: expandLabels.expandRow,
            onToggleRow: toggleExpandedRow,
            renderExpandedRow: (row: TData) => renderExpandedRowRef.current?.(row) ?? null,
          }
        : undefined,
    [
      expandLabels.collapseRow,
      expandLabels.expandRow,
      isExpandable,
      toggleExpandedRow,
    ],
  )

  function pinGroupOf(columnId: string): 'left' | 'right' | 'center' {
    if ((normalizedLayout.columnPinning.left ?? []).includes(columnId)) {
      return 'left'
    }

    if ((normalizedLayout.columnPinning.right ?? []).includes(columnId)) {
      return 'right'
    }

    return 'center'
  }

  // Sticky pinned headers report their stuck viewport position, so when the table
  // is horizontally scrolled their rects overlap center columns and closestCenter
  // resolves drops onto pinned ids. Only collide within the active pin group.
  const collisionDetection: CollisionDetection = (args) => {
    const activeGroup = pinGroupOf(String(args.active.id))

    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => pinGroupOf(String(container.id)) === activeGroup,
      ),
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    const activeGroup = pinGroupOf(activeId)

    // TanStack renders pinned headers in the columnPinning array's order (not
    // columnOrder), so reordering inside a pinned group must move the id within
    // the pinning array itself — moving columnOrder alone changes nothing visually.
    if (activeGroup !== 'center' && pinGroupOf(overId) === activeGroup) {
      handleColumnPinningChange((currentPinning) => {
        const pinned = currentPinning[activeGroup] ?? []
        const activeIndex = pinned.indexOf(activeId)
        const overIndex = pinned.indexOf(overId)

        if (activeIndex === -1 || overIndex === -1) {
          return currentPinning
        }

        return { ...currentPinning, [activeGroup]: arrayMove(pinned, activeIndex, overIndex) }
      })
      return
    }

    handleColumnOrderChange((currentOrder) => {
      const activeIndex = currentOrder.indexOf(activeId)
      const overIndex = currentOrder.indexOf(overId)

      if (activeIndex === -1 || overIndex === -1) {
        return currentOrder
      }

      return arrayMove(currentOrder, activeIndex, overIndex)
    })
  }

  function handleResetLayout() {
    clearDataTableLayout(tableId)
    setLayout(createDefaultDataTableLayout(columnIds, effectiveDefaultLayout))
  }

  const toolbarNode =
    showLayoutControls || toolbarLeft || toolbarRight ? (
      <DataTableToolbar
        columnTitles={columnTitles}
        density={effectiveDensity}
        isColumnDragActive={isColumnDragActive}
        labels={labels}
        showLayoutControls={showLayoutControls}
        showDensityToggle={showDensityToggle && controlledDensity === undefined}
        table={table}
        toolbarLeft={toolbarLeft}
        toolbarRight={toolbarRight}
        onDensityChange={handleDensityChange}
        onResetLayout={handleResetLayout}
      />
    ) : null
  // When a portal target is provided, render the toolbar there (e.g. lifted into a
  // page's own toolbar) instead of inline above the table.
  const portalToolbar = toolbarPortalTarget !== undefined

  return (
    <div className={`data-table data-table-density-${effectiveDensity}`}>
      {portalToolbar ? null : toolbarNode}
      {portalToolbar && toolbarPortalTarget && toolbarNode
        ? createPortal(toolbarNode, toolbarPortalTarget)
        : null}

      <div ref={setScrollNode} className="data-table-scroll" style={scrollStyle}>
        <DndContext
          collisionDetection={collisionDetection}
          modifiers={[restrictToHorizontalAxis]}
          sensors={sensors}
          onDragStart={() => setIsColumnDragActive(true)}
          onDragCancel={() => setIsColumnDragActive(false)}
          onDragEnd={(event) => {
            setIsColumnDragActive(false)
            handleDragEnd(event)
          }}
        >
          <Table
            className="data-table-table"
            highlightOnHover={false}
            style={{ minWidth: minWidth + expandColumnWidth, width: tableWidth }}
            withTableBorder={false}
          >
            <colgroup>
              {isExpandable ? (
                <col style={{ width: EXPAND_COLUMN_WIDTH }} />
              ) : null}
              {firstHeaderGroupColumns.leading.map((header) => (
                <col
                  key={header.id}
                  style={{
                    width: columnWidths.get(header.column.id) ?? header.column.getSize(),
                  }}
                />
              ))}
              {fillerColumnWidth > 0 ? (
                <col style={{ width: fillerColumnWidth }} />
              ) : null}
              {firstHeaderGroupColumns.rightPinned.map((header) => (
                <col
                  key={header.id}
                  style={{
                    width: columnWidths.get(header.column.id) ?? header.column.getSize(),
                  }}
                />
              ))}
            </colgroup>
            <Table.Thead>
              {headerGroups.map((headerGroup) => (
                <DataTableHeaderRow
                  key={headerGroup.id}
                  columnWidths={columnWidths}
                  expandColumnWidth={expandColumnWidth}
                  fillerColumnWidth={fillerColumnWidth}
                  fillColumnId={fillColumnId}
                  headerGroupId={headerGroup.id}
                  headers={headerGroup.headers}
                  isColumnDragActive={isColumnDragActive}
                  isExpandable={isExpandable}
                  labels={labels}
                  showLayoutControls={showLayoutControls}
                />
              ))}
            </Table.Thead>
            <DataTableBody
              columnWidths={columnWidths}
              expand={expandConfig}
              expandedRowIds={expandedRowIds}
              fillerColumnWidth={fillerColumnWidth}
              fillColumnId={fillColumnId}
              // Hold the skeleton until the viewport width is measured on fill
              // tables — otherwise the fill column renders narrow (base width)
              // then jumps wide once measured, reading as a column "sliding" to
              // full width during load.
              isLoading={isLoading && (!shouldFillAvailableWidth || scrollViewportWidth > 0)}
              pinnedLeftOffset={expandColumnWidth}
              table={table}
              visibleColumnCount={visibleColumnCount}
              onRowClick={onRowClick}
              rowClassName={rowClassName}
            />
          </Table>
        </DndContext>
        {isEmpty ? (
          <div
            className="data-table-empty"
            style={{ width: scrollViewportWidth ? `${scrollViewportWidth}px` : '100%' }}
          >
            <div className="data-table-empty-content">
              {normalizedEmptyText ?? labels.noData}
            </div>
          </div>
        ) : null}
      </div>
      {footer ? <div className="data-table-footer">{footer}</div> : null}
    </div>
  )
}

function DataTableHeaderRow<TData>({
  columnWidths,
  expandColumnWidth,
  fillerColumnWidth,
  fillColumnId,
  headerGroupId,
  headers,
  isColumnDragActive,
  isExpandable,
  labels,
  showLayoutControls,
}: {
  columnWidths: ReadonlyMap<string, number>
  expandColumnWidth: number
  fillerColumnWidth: number
  fillColumnId?: string
  headerGroupId: string
  headers: Header<TData, unknown>[]
  isColumnDragActive: boolean
  isExpandable: boolean
  labels: Required<DataTableLabels>
  showLayoutControls: boolean
}) {
  const { leading, rightPinned } = splitRightPinnedHeaders(headers)

  function renderHeader(header: Header<TData, unknown>) {
    const pinned = header.column.getIsPinned()

    return (
      <DataTableHeaderCell
        key={header.id}
        columnWidth={columnWidths.get(header.column.id) ?? header.getSize()}
        header={header}
        isColumnDragActive={isColumnDragActive}
        isFillColumn={header.column.id === fillColumnId}
        isResizing={header.column.getIsResizing()}
        labels={labels}
        pinned={pinned}
        pinnedLeftPx={
          pinned === 'left'
            ? Math.round(header.column.getStart('left')) + expandColumnWidth
            : undefined
        }
        pinnedRightPx={
          pinned === 'right' ? Math.round(header.column.getAfter('right')) : undefined
        }
        showLayoutControls={showLayoutControls}
        sorted={header.column.getIsSorted()}
      />
    )
  }

  return (
    <Table.Tr key={headerGroupId}>
      {isExpandable ? (
        <Table.Th
          aria-hidden
          className="data-table-th data-table-expand-th"
          style={{ width: expandColumnWidth, minWidth: expandColumnWidth }}
        />
      ) : null}
      {/* Items must mirror the RENDERED data-header sequence (pinned left,
          center, pinned right; hidden columns excluded). The filler is visual
          chrome only and is intentionally not sortable/draggable. */}
      <SortableContext
        items={headers.map((header) => header.column.id)}
        strategy={horizontalListSortingStrategy}
      >
        {leading.map(renderHeader)}
        {fillerColumnWidth > 0 ? (
          <Table.Th
            aria-hidden
            className="data-table-th data-table-filler-th"
            style={{ width: fillerColumnWidth, minWidth: fillerColumnWidth }}
          />
        ) : null}
        {rightPinned.map(renderHeader)}
      </SortableContext>
    </Table.Tr>
  )
}

function splitRightPinnedHeaders<TData>(headers: Header<TData, unknown>[]) {
  const leading: Header<TData, unknown>[] = []
  const rightPinned: Header<TData, unknown>[] = []

  headers.forEach((header) => {
    if (header.column.getIsPinned() === 'right') {
      rightPinned.push(header)
    } else {
      leading.push(header)
    }
  })

  return { leading, rightPinned }
}

function createScrollStyle(
  height?: string | number,
  maxHeight?: string | number,
  isMeasured = true,
): CSSProperties {
  const measurementStyle: CSSProperties = isMeasured ? {} : { visibility: 'hidden' }

  if (height !== undefined) {
    return { ...measurementStyle, height }
  }

  if (maxHeight !== undefined) {
    return { ...measurementStyle, maxHeight }
  }

  return measurementStyle
}

function resolveStateUpdater<TValue>(
  updater: TValue | ((currentValue: TValue) => TValue),
  currentValue: TValue,
) {
  return typeof updater === 'function'
    ? (updater as (currentValue: TValue) => TValue)(currentValue)
    : updater
}

function readCompatibleDataTableLayout(tableId: string, layoutVersion?: string) {
  const storedLayout = readDataTableLayout(tableId)

  if (layoutVersion && storedLayout.version !== layoutVersion) {
    return {}
  }

  return storedLayout
}

function normalizeLayoutVersion(layoutVersion?: number | string) {
  return layoutVersion === undefined ? undefined : String(layoutVersion)
}

function createExpandColumnLabels(
  t: TranslateFunction,
  labelsOverride?: DataTableExpandColumnLabels,
): Required<DataTableExpandColumnLabels> {
  return {
    collapseRow: labelsOverride?.collapseRow ?? t('Згорнути рядок'),
    expandRow: labelsOverride?.expandRow ?? t('Розгорнути рядок'),
  }
}

function createDefaultLabels(t: TranslateFunction): Required<DataTableLabels> {
  return {
    columns: t('Колонки'),
    compactDensity: t('Компактно'),
    density: t('Щільність'),
    dragColumn: t('Перетягнути колонку'),
    emptyValue: '—',
    hideColumn: t('Приховати колонку'),
    loadingData: t('Завантаження даних'),
    no: t('Ні'),
    noData: t('Даних не знайдено'),
    normalDensity: t('Стандартно'),
    pinnedColumn: t('Закріплена колонка'),
    pinLeft: t('Закріпити зліва'),
    pinRight: t('Закріпити справа'),
    resizeColumn: t('Змінити ширину колонки'),
    resetLayout: t('Скинути вигляд'),
    sortAscending: t('Сортувати за зростанням'),
    sortDescending: t('Сортувати за спаданням'),
    unpin: t('Відкріпити'),
    yes: t('Так'),
  }
}

function formatCellValue(value: unknown, labels: Required<DataTableLabels>) {
  if (value === null || value === undefined || value === '') {
    return labels.emptyValue
  }

  if (typeof value === 'boolean') {
    return value ? labels.yes : labels.no
  }

  return String(value)
}
