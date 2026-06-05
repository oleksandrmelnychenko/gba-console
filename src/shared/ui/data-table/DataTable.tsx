import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Table } from '@mantine/core'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
import { getPinnedStyle } from './dataTablePinning'
import { createRenderedColumnWidths, getFillColumnId } from './dataTableSizing'
import { DataTableToolbar } from './DataTableToolbar'
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

export function DataTable<TData>({
  columns,
  data,
  tableId,
  defaultLayout,
  layoutVersion,
  getRowId,
  isLoading = false,
  minWidth = 960,
  height,
  maxHeight,
  emptyText,
  loadingText,
  labels: labelsOverride,
  showLayoutControls = true,
  toolbarLeft,
  toolbarRight,
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
      defaultLayout,
    ),
  )
  const normalizedLayout = useMemo(
    () => normalizeDataTableLayout(layout, columnIds, defaultLayout),
    [columnIds, defaultLayout, layout],
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
        enablePinning: column.enablePinning !== false,
        enableResizing: column.enableResizing !== false,
        enableSorting: column.enableSorting ?? Boolean(column.accessor),
        maxSize: column.maxWidth,
        meta,
        minSize: column.minWidth,
        size: column.width,
      }
    })
  }, [columns, labels, t])

  function updateLayout(
    updater: (currentLayout: NormalizedDataTableLayout) => NormalizedDataTableLayout,
  ) {
    setLayout((currentLayout) =>
      normalizeDataTableLayout(
        updater(normalizeDataTableLayout(currentLayout, columnIds, defaultLayout)),
        columnIds,
        defaultLayout,
      ),
    )
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
    updateLayout((currentLayout) => ({
      ...currentLayout,
      density,
    }))
  }

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
    columnResizeMode: 'onChange',
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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const expandColumnWidth = isExpandable ? EXPAND_COLUMN_WIDTH : 0
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const baseTableWidth = table.getTotalSize() + expandColumnWidth
  const tableWidth = Math.ceil(
    Math.max(minWidth + expandColumnWidth, baseTableWidth, scrollViewportWidth),
  )
  const fillColumnId = getFillColumnId(visibleLeafColumns, tableWidth, baseTableWidth)
  const fillColumnExtraWidth = fillColumnId ? tableWidth - baseTableWidth : 0
  const columnWidths = createRenderedColumnWidths(
    visibleLeafColumns,
    fillColumnId,
    fillColumnExtraWidth,
  )
  const visibleColumnCount = visibleLeafColumns.length || 1
  const scrollStyle = useMemo(
    () => createScrollStyle(height, maxHeight),
    [height, maxHeight],
  )
  const normalizedEmptyText = typeof emptyText === 'string' ? t(emptyText) : emptyText
  const normalizedLoadingText = typeof loadingText === 'string' ? t(loadingText) : loadingText

  const expandConfig = useMemo(
    () =>
      renderExpandedRow
        ? {
            canExpandRow: (row: TData) => getRowCanExpand?.(row) ?? true,
            collapseLabel: expandLabels.collapseRow,
            expandLabel: expandLabels.expandRow,
            isRowExpanded: (rowId: string) => expandedRowIds.has(rowId),
            onToggleRow: toggleExpandedRow,
            renderExpandedRow,
          }
        : undefined,
    [
      expandLabels.collapseRow,
      expandLabels.expandRow,
      expandedRowIds,
      getRowCanExpand,
      renderExpandedRow,
      toggleExpandedRow,
    ],
  )

  useEffect(() => {
    writeDataTableLayout(tableId, {
      ...normalizedLayout,
      version: normalizedLayoutVersion,
    })
  }, [normalizedLayout, normalizedLayoutVersion, tableId])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    handleColumnOrderChange((currentOrder) => {
      const activeIndex = currentOrder.indexOf(String(active.id))
      const overIndex = currentOrder.indexOf(String(over.id))

      if (activeIndex === -1 || overIndex === -1) {
        return currentOrder
      }

      return arrayMove(currentOrder, activeIndex, overIndex)
    })
  }

  function handleResetLayout() {
    clearDataTableLayout(tableId)
    setLayout(createDefaultDataTableLayout(columnIds, defaultLayout))
  }

  return (
    <div className={`data-table data-table-density-${normalizedLayout.density}`}>
      {showLayoutControls || toolbarLeft || toolbarRight ? (
        <DataTableToolbar
          columnTitles={columnTitles}
          density={normalizedLayout.density}
          labels={labels}
          showLayoutControls={showLayoutControls}
          table={table}
          toolbarLeft={toolbarLeft}
          toolbarRight={toolbarRight}
          onDensityChange={handleDensityChange}
          onResetLayout={handleResetLayout}
        />
      ) : null}

      <div ref={setScrollNode} className="data-table-scroll" style={scrollStyle}>
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          <Table
            className="data-table-table"
            highlightOnHover={false}
            style={{ minWidth: minWidth + expandColumnWidth, width: tableWidth }}
            withTableBorder={false}
          >
            <Table.Thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <Table.Tr key={headerGroup.id}>
                  {isExpandable ? (
                    <Table.Th
                      aria-hidden
                      className="data-table-th data-table-expand-th"
                      style={{ width: EXPAND_COLUMN_WIDTH, minWidth: EXPAND_COLUMN_WIDTH }}
                    />
                  ) : null}
                  <SortableContext
                    items={normalizedLayout.columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => (
                      <DataTableHeaderCell
                        key={header.id}
                        columnWidth={columnWidths.get(header.column.id) ?? header.getSize()}
                        header={header}
                        isFillColumn={header.column.id === fillColumnId}
                        labels={labels}
                        pinnedStyle={getPinnedStyle(header.column, 3, expandColumnWidth)}
                        showLayoutControls={showLayoutControls}
                      />
                    ))}
                  </SortableContext>
                </Table.Tr>
              ))}
            </Table.Thead>
            <DataTableBody
              emptyText={normalizedEmptyText}
              columnWidths={columnWidths}
              expand={expandConfig}
              fillColumnId={fillColumnId}
              isLoading={isLoading}
              labels={labels}
              loadingText={normalizedLoadingText}
              pinnedLeftOffset={expandColumnWidth}
              table={table}
              visibleColumnCount={visibleColumnCount}
              onRowClick={onRowClick}
              rowClassName={rowClassName}
            />
          </Table>
        </DndContext>
      </div>
    </div>
  )
}

function createScrollStyle(
  height?: string | number,
  maxHeight?: string | number,
): CSSProperties {
  if (height !== undefined) {
    return { height }
  }

  if (maxHeight !== undefined) {
    return { maxHeight }
  }

  return {}
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
