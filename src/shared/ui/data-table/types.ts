import type { ReactNode } from 'react'
import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'

export type DataTableSortingState = SortingState
export type DataTableDensity = 'compact' | 'normal'
export type DataTableDefaultLayout = {
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  columnPinning?: ColumnPinningState
  columnSizing?: ColumnSizingState
  density?: DataTableDensity
}

export type DataTableColumn<TData> = {
  id: string
  header: ReactNode
  accessor?: (row: TData) => unknown
  cell?: (row: TData) => ReactNode
  width?: number
  minWidth?: number
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  className?: string
  /** When true, this column absorbs the extra horizontal space so the table fills its container. */
  fill?: boolean
  enableSorting?: boolean
  enableHiding?: boolean
  enablePinning?: boolean
  enableReorder?: boolean
  enableResizing?: boolean
}

export type DataTableLabels = {
  columns?: string
  dragColumn?: string
  compactDensity?: string
  density?: string
  hideColumn?: string
  loadingData?: string
  noData?: string
  normalDensity?: string
  pinnedColumn?: string
  pinLeft?: string
  pinRight?: string
  resizeColumn?: string
  resetLayout?: string
  sortAscending?: string
  sortDescending?: string
  unpin?: string
  emptyValue?: string
  no?: string
  yes?: string
}

export type DataTableProps<TData> = {
  columns: DataTableColumn<TData>[]
  data: TData[]
  tableId: string
  defaultLayout?: DataTableDefaultLayout
  layoutVersion?: number | string
  getRowId?: (row: TData, index: number) => string
  isLoading?: boolean
  minWidth?: number
  /** When false, columns keep their configured widths instead of stretching one column to fill the viewport. */
  fillAvailableWidth?: boolean
  /** Spreads the extra viewport width across regular columns instead of growing a single fill column. */
  distributeAvailableWidth?: boolean
  height?: string | number
  maxHeight?: string | number
  emptyText?: ReactNode
  loadingText?: ReactNode
  labels?: DataTableLabels
  showLayoutControls?: boolean
  /** Shows a built-in compact/normal density toggle in the toolbar. Defaults to true. */
  showDensityToggle?: boolean
  /** Controlled row density. When set, overrides the stored/default layout density. */
  density?: DataTableDensity
  onDensityChange?: (density: DataTableDensity) => void
  toolbarLeft?: ReactNode
  toolbarRight?: ReactNode
  /** Render the toolbar into this element (via portal) instead of inline above the
   *  table — used to lift the columns/density controls into a page's own toolbar. */
  toolbarPortalTarget?: Element | null
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string | undefined
  manualSorting?: boolean
  sorting?: DataTableSortingState
  onSortingChange?: (sorting: DataTableSortingState) => void
  renderExpandedRow?: (row: TData) => ReactNode
  getRowCanExpand?: (row: TData) => boolean
  expandColumnLabels?: DataTableExpandColumnLabels
}

export type DataTableExpandColumnLabels = {
  collapseRow?: string
  expandRow?: string
}

export type DataTableColumnMeta = {
  align?: 'left' | 'center' | 'right'
  className?: string
  enableReorder?: boolean
  fill?: boolean
}
