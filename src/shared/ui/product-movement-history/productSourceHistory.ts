import type { DataTableColumn } from '../data-table/types'

export type ProductSourceHistoryInfo = {
  RowKey: string
  SourceSystem: string
  SourceDocumentType: number
  HasCurrentBalance: boolean
  HasPhysicalMovement: boolean
  SourceUnitPrice?: number | null
  SourceAmount?: number | null
  SourceVatAmount?: number | null
  SourceCurrency?: string | null
}

/** Internal identity for a physical register row, not a native GBA document link. */
export type PhysicalSourceMovementIdentity = {
  PublicationId: string
  World: string
  RecorderType: number
  RecorderId: string
  LineNumber: number
  BatchValueType: string
  BatchTable: string
  BatchId: string
}

export type ProductSourceHistoryRow = {
  Id?: number | null
  NetUid?: string | null
  SourceHistory?: ProductSourceHistoryInfo | null
  PhysicalSource?: PhysicalSourceMovementIdentity | null
  ValuationKnown?: boolean | null
  PhysicalSourceCostEur?: number | null
  PhysicalSourceVatEur?: number | null
}

/** Preserve every source row and batch; display captions/native null IDs are not identities. */
export function getPhysicalSourceMovementKey(row: ProductSourceHistoryRow): string | undefined {
  const source = row.PhysicalSource
  if (!source) return undefined
  return `physical:${JSON.stringify([
    source.PublicationId, source.World, source.RecorderType, source.RecorderId,
    source.LineNumber, source.BatchValueType, source.BatchTable, source.BatchId,
  ])}`
}

export function getProductMovementRowKey(row: ProductSourceHistoryRow, fallback: string): string {
  return getPhysicalSourceMovementKey(row)
    ?? String(row.SourceHistory?.RowKey || row.NetUid || row.Id || fallback)
}

function physicalMoney(row: ProductSourceHistoryRow, field: 'PhysicalSourceCostEur' | 'PhysicalSourceVatEur'): number | undefined {
  const value = row[field]
  return row.PhysicalSource && row.ValuationKnown === true && value != null && Number.isFinite(value)
    ? value : undefined
}

const legacyFinancialColumns = new Set([
  'price', 'accountingPrice', 'discount', 'netPrice', 'totalNetPrice', 'grossPrice',
  'accountingGrossPrice', 'managementEurUnitPrice', 'accountingEurUnitPrice',
  'unitPriceLocal', 'exchangeRate', 'returnPrice', 'priceDifference', 'weight', 'currency',
])
const physicalQuantityColumns = new Set(['income', 'outcome', 'incomeQty', 'outcomeQty', 'qty'])
const physicalQuantityFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 8 })
const sourceMoneyFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4 })

export function formatSourceHistoryMoney(value?: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : sourceMoneyFormat.format(value)
}

export function getProductSourceHistoryLabel(row: ProductSourceHistoryRow, t: (key: string) => string): string {
  if (row.PhysicalSource) return t('Складський рух')
  const history = row.SourceHistory
  if (!history) return 'GBA'
  const label = `${t('Історія 1С')} · ${history.SourceSystem}`
  return history.HasPhysicalMovement ? label : `${label} · ${t('Без складського руху')}`
}

/** Physical valuation is explicit; legacy unit prices and document amounts cannot substitute for it. */
export function withProductSourceHistoryColumns<T extends ProductSourceHistoryRow>(
  columns: DataTableColumn<T>[],
  t: (key: string) => string,
): DataTableColumn<T>[] {
  const decorated = columns.map((column): DataTableColumn<T> => {
    if (physicalQuantityColumns.has(column.id)) {
      return {
        ...column,
        cell: (row) => {
          if (!row.PhysicalSource) return column.cell?.(row)
          const value = column.accessor?.(row)
          return typeof value === 'number' && Number.isFinite(value) ? physicalQuantityFormat.format(value) : '—'
        },
      }
    }
    const isBalance = column.id === 'remainingQty' || column.id === 'remaining'
    if (!legacyFinancialColumns.has(column.id) && !isBalance) return column
    const isUnavailable = (row: T) => Boolean(row.PhysicalSource
      || (!isBalance && row.ValuationKnown === false)
      || (row.SourceHistory && (!isBalance || !row.SourceHistory.HasCurrentBalance)))
    return {
      ...column,
      accessor: (row) => isUnavailable(row) ? undefined : column.accessor?.(row),
      cell: (row) => isUnavailable(row) ? '—' : column.cell?.(row),
    }
  })
  return [
    {
      id: 'physicalMovementCost', header: t('Собівартість руху, EUR'), minWidth: 170, align: 'right',
      accessor: (row) => physicalMoney(row, 'PhysicalSourceCostEur'),
      cell: (row) => formatSourceHistoryMoney(physicalMoney(row, 'PhysicalSourceCostEur')),
    },
    {
      id: 'physicalMovementVat', header: t('ПДВ руху, EUR'), minWidth: 150, align: 'right',
      accessor: (row) => physicalMoney(row, 'PhysicalSourceVatEur'),
      cell: (row) => formatSourceHistoryMoney(physicalMoney(row, 'PhysicalSourceVatEur')),
    },
    {
      id: 'sourceHistory', header: t('Джерело історії'), minWidth: 200,
      accessor: (row) => getProductSourceHistoryLabel(row, t),
      cell: (row) => getProductSourceHistoryLabel(row, t),
    },
    {
      id: 'sourceDocumentPrice', header: t('Ціна документа'), minWidth: 130, align: 'right',
      accessor: (row) => (row.PhysicalSource ? undefined : row.SourceHistory?.SourceUnitPrice),
      cell: (row) => formatSourceHistoryMoney(row.PhysicalSource ? undefined : row.SourceHistory?.SourceUnitPrice),
    },
    {
      id: 'sourceDocumentAmount', header: t('Сума документа'), minWidth: 130, align: 'right',
      accessor: (row) => (row.PhysicalSource ? undefined : row.SourceHistory?.SourceAmount),
      cell: (row) => formatSourceHistoryMoney(row.PhysicalSource ? undefined : row.SourceHistory?.SourceAmount),
    },
    {
      id: 'sourceDocumentVat', header: t('ПДВ документа'), minWidth: 130, align: 'right',
      accessor: (row) => (row.PhysicalSource ? undefined : row.SourceHistory?.SourceVatAmount),
      cell: (row) => formatSourceHistoryMoney(row.PhysicalSource ? undefined : row.SourceHistory?.SourceVatAmount),
    },
    {
      id: 'sourceDocumentCurrency', header: t('Валюта документа'), minWidth: 130,
      accessor: (row) => (row.PhysicalSource ? undefined : row.SourceHistory?.SourceCurrency),
      cell: (row) => (row.PhysicalSource ? undefined : row.SourceHistory?.SourceCurrency) || '—',
    },
    ...decorated,
  ]
}
