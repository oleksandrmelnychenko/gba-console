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

export type ProductSourceHistoryRow = { SourceHistory?: ProductSourceHistoryInfo | null }

const legacyFinancialColumns = new Set([
  'price', 'accountingPrice', 'discount', 'netPrice', 'totalNetPrice', 'grossPrice',
  'accountingGrossPrice', 'managementEurUnitPrice', 'accountingEurUnitPrice',
  'unitPriceLocal', 'exchangeRate', 'returnPrice', 'priceDifference', 'weight', 'currency',
])
const sourceMoneyFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4 })

export function formatSourceHistoryMoney(value?: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : sourceMoneyFormat.format(value)
}

export function getProductSourceHistoryLabel(row: ProductSourceHistoryRow, t: (key: string) => string): string {
  const history = row.SourceHistory
  if (!history) return 'GBA'
  const label = `${t('Історія 1С')} · ${history.SourceSystem}`
  return history.HasPhysicalMovement ? label : `${label} · ${t('Без складського руху')}`
}

/** Keep legacy columns intact; source document amounts are never labelled as GBA cost or EUR. */
export function withProductSourceHistoryColumns<T extends ProductSourceHistoryRow>(
  columns: DataTableColumn<T>[],
  t: (key: string) => string,
): DataTableColumn<T>[] {
  const decorated = columns.map((column): DataTableColumn<T> => {
    const isBalance = column.id === 'remainingQty' || column.id === 'remaining'
    if (!legacyFinancialColumns.has(column.id) && !isBalance) return column
    const isUnavailable = (row: T) => Boolean(row.SourceHistory
      && (!isBalance || !row.SourceHistory.HasCurrentBalance))
    return {
      ...column,
      accessor: (row) => isUnavailable(row) ? undefined : column.accessor?.(row),
      cell: (row) => isUnavailable(row) ? '—' : column.cell?.(row),
    }
  })
  return [
    {
      id: 'sourceHistory', header: t('Джерело історії'), minWidth: 200,
      accessor: (row) => getProductSourceHistoryLabel(row, t),
      cell: (row) => getProductSourceHistoryLabel(row, t),
    },
    {
      id: 'sourceDocumentPrice', header: t('Ціна документа'), minWidth: 130, align: 'right',
      accessor: (row) => row.SourceHistory?.SourceUnitPrice,
      cell: (row) => formatSourceHistoryMoney(row.SourceHistory?.SourceUnitPrice),
    },
    {
      id: 'sourceDocumentAmount', header: t('Сума документа'), minWidth: 130, align: 'right',
      accessor: (row) => row.SourceHistory?.SourceAmount,
      cell: (row) => formatSourceHistoryMoney(row.SourceHistory?.SourceAmount),
    },
    {
      id: 'sourceDocumentVat', header: t('ПДВ документа'), minWidth: 130, align: 'right',
      accessor: (row) => row.SourceHistory?.SourceVatAmount,
      cell: (row) => formatSourceHistoryMoney(row.SourceHistory?.SourceVatAmount),
    },
    {
      id: 'sourceDocumentCurrency', header: t('Валюта документа'), minWidth: 130,
      accessor: (row) => row.SourceHistory?.SourceCurrency,
      cell: (row) => row.SourceHistory?.SourceCurrency || '—',
    },
    ...decorated,
  ]
}
