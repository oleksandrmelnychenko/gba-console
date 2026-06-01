import { Table, Text } from '@mantine/core'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
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

  return (
    <Table withTableBorder withColumnBorders striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('Назва товару')}</Table.Th>
          <Table.Th>{currencyCode}</Table.Th>
          <Table.Th>{localCurrencyCode}</Table.Th>
          <Table.Th>{t('ПДВ')}</Table.Th>
          <Table.Th>{t('К-сть')}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {orders.map((item, index) => (
          <Table.Tr key={item.NetUid || item.Id || index}>
            <Table.Td>{formatProductName(item)}</Table.Td>
            <Table.Td>{formatPrice(item.TotalAmount)}</Table.Td>
            <Table.Td>{formatPrice(item.TotalAmountLocal)}</Table.Td>
            <Table.Td>{(item.TotalVat || 0) > 0 ? formatPrice(item.TotalVat) : ''}</Table.Td>
            <Table.Td>{displayValue(item.Qty)}</Table.Td>
          </Table.Tr>
        ))}
        {orders.length > 1 && (
          <Table.Tr>
            <Table.Td />
            <Table.Td>
              <Text fw={700}>{formatPrice(totals.totalAmount)}</Text>
            </Table.Td>
            <Table.Td>
              <Text fw={700}>{formatPrice(totals.totalAmountLocal)}</Text>
            </Table.Td>
            <Table.Td>
              <Text fw={700}>{totals.totalVat > 0 ? formatPrice(totals.totalVat) : ''}</Text>
            </Table.Td>
            <Table.Td>
              <Text fw={700}>{totals.totalQty}</Text>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
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
