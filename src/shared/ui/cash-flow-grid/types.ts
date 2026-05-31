import type { ReactNode } from 'react'

export type CashFlowGridSign = 'credit' | 'debit'

export type CashFlowGridItem = {
  Name?: string
  Number?: string
  FromDate?: string
  OrganizationName?: string
  Type?: number
  IsCreditValue?: boolean
  CurrentValue?: number
  CurrentBalance?: number
}

export type CashFlowGridSummary = {
  beforeInAmount?: number
  beforeOutAmount?: number
  beforeBalance?: number
  afterInAmount?: number
  afterOutAmount?: number
  closingBalance?: number
}

export type CashFlowGridLeadColumn<TItem extends CashFlowGridItem> = {
  id: string
  header?: ReactNode
  width?: number | string
  align?: 'center' | 'left' | 'right'
  isLabel?: boolean
  cell: (item: TItem) => ReactNode
  topCell?: ReactNode
  footCell?: ReactNode
}

export type CashFlowGridLabels = {
  income?: string
  outcome?: string
  debit?: string
  credit?: string
  balance?: string
  bottomLine?: string
}

export type CashFlowGridProps<TItem extends CashFlowGridItem = CashFlowGridItem> = {
  items: TItem[]
  leadColumns: CashFlowGridLeadColumn<TItem>[]
  summary?: CashFlowGridSummary
  labels?: CashFlowGridLabels
  columnWidth?: number
  maxHeight?: number | string
  isLoading?: boolean
  emptyText?: ReactNode
  loadingText?: ReactNode
  getRowKey?: (item: TItem, index: number) => string
  isRowActive?: (item: TItem, index: number) => boolean
  renderRowBadge?: (item: TItem) => ReactNode
  formatMoney?: (value?: number) => string
  onRowClick?: (item: TItem, index: number) => void
  onSelectDebit?: (item: TItem, index: number) => void
  onSelectCredit?: (item: TItem, index: number) => void
}
