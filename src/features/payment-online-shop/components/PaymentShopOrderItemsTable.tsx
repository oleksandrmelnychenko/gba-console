import { Table, Text } from '@mantine/core'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import type { PaymentShopOrderItem, PaymentShopSale } from '../types'

const priceFormatter = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export type PaymentShopOrderItemsTableProps = {
  currencyCode: string
  localCurrencyCode: string
  orders: PaymentShopOrderItem[]
  sale: PaymentShopSale | null
}

export function PaymentShopOrderItemsTable({
  currencyCode,
  localCurrencyCode,
  orders,
  sale,
}: PaymentShopOrderItemsTableProps) {
  const { t } = useI18n()
  const totals = useMemo(() => computeTotals(orders, sale), [orders, sale])

  const columns = useMemo<DataTableColumn<PaymentShopOrderItem>[]>(() => [
    { id: 'productName', header: t('Назва товару'), minWidth: 240, accessor: (row) => formatProductName(row), cell: (row) => formatProductName(row) },
    { id: 'amount', header: currencyCode, minWidth: 120, accessor: (row) => row.TotalAmount, cell: (row) => formatPrice(row.TotalAmount) },
    { id: 'amountLocal', header: localCurrencyCode, minWidth: 120, accessor: (row) => row.TotalAmountLocal, cell: (row) => formatPrice(row.TotalAmountLocal) },
    { id: 'vat', header: t('ПДВ'), minWidth: 110, accessor: (row) => row.TotalVat, cell: (row) => ((row.TotalVat || 0) > 0 ? formatPrice(row.TotalVat) : '') },
    { id: 'qty', header: t('К-сть'), minWidth: 90, accessor: (row) => row.Qty, cell: (row) => displayValue(row.Qty) },
  ], [currencyCode, localCurrencyCode, t])

  return (
    <>
      <DataTable
        columns={columns}
        data={orders}
        emptyText={t('Товарів не знайдено')}
        getRowId={(row, index) => String(row.NetUid || row.Id || index)}
        maxHeight="calc(100vh - 320px)"
        minWidth={660}
        tableId="payment-shop-order-items"
      />
      {orders.length > 1 && (
        <Table withTableBorder withColumnBorders>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td style={{ minWidth: 240 }} />
              <Table.Td style={{ minWidth: 120 }}>
                <Text fw={700}>{formatPrice(totals.totalAmount)}</Text>
              </Table.Td>
              <Table.Td style={{ minWidth: 120 }}>
                <Text fw={700}>{formatPrice(totals.totalAmountLocal)}</Text>
              </Table.Td>
              <Table.Td style={{ minWidth: 110 }}>
                <Text fw={700}>{totals.totalVat > 0 ? formatPrice(totals.totalVat) : ''}</Text>
              </Table.Td>
              <Table.Td style={{ minWidth: 90 }}>
                <Text fw={700}>{totals.totalQty}</Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      )}
    </>
  )
}

function computeTotals(orders: PaymentShopOrderItem[], sale: PaymentShopSale | null) {
  const order = sale?.Order

  return {
    totalAmount: order?.TotalAmount || 0,
    totalAmountLocal: order?.TotalAmountLocal || 0,
    totalQty: orders.reduce((sum, item) => sum + (item.Qty || 0), 0),
    totalVat: order?.TotalVat || 0,
  }
}

function formatProductName(item: PaymentShopOrderItem): string {
  const product = item.Product

  return [product?.VendorCode, product?.MainOriginalNumber, product?.Name].filter(Boolean).join(' ')
}

function formatPrice(value: number | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return ''
  }

  return priceFormatter.format(value)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value)
}
