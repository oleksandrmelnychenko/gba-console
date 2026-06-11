import { Box, Group, Paper, ScrollArea, Table, Text } from '@mantine/core'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { roundMoney } from '../../saleMoney'
import type { SalesUkraineOrderItem, SalesUkraineUser } from '../../types'
import { getOrderItemDiscount, getWizardProductNumber, type WizardSaleProduct } from './wizardSaleProduct'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const priceFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export type WizardSplitOrderItem = {
  Comment?: string
  Product: WizardSaleProduct
  Qty: number
  TotalAmount: number
  TotalAmountEurToUah: number
  TotalAmountLocal: number
  User?: SalesUkraineUser
}

export type WizardCartSelection = {
  index: number
  list: 'current' | 'split'
}

export function EditShoppingCartOverlay({
  currentItems,
  isSplit,
  localCurrencyCode,
  selected,
  splitItems,
}: {
  currentItems: SalesUkraineOrderItem[]
  isSplit: boolean
  localCurrencyCode: string
  selected: WizardCartSelection | null
  splitItems: WizardSplitOrderItem[]
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!selected) {
      return
    }

    const row = rootRef.current?.querySelector(`[data-cart-row="${selected.list}-${selected.index}"]`)
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])

  const currentRows = currentItems.map((item) => ({
    amountLocal: getWizardProductNumber(item.TotalAmountEurToUah) ?? 0,
    comment: item.Comment || '',
    discount: getOrderItemDiscount(item),
    localPrice: getWizardProductNumber((item.Product as WizardSaleProduct | undefined)?.CurrentPriceEurToUah) ?? 0,
    name: item.Product?.NameUA || item.Product?.Name || '—',
    oneTimeDiscount: getWizardProductNumber(item.OneTimeDiscount) ?? 0,
    originalNumber: item.Product?.MainOriginalNumber || '',
    price: getWizardProductNumber((item.Product as WizardSaleProduct | undefined)?.CurrentPrice) ?? 0,
    qty: getWizardProductNumber(item.Qty) ?? 0,
    totalAmount: getWizardProductNumber(item.TotalAmount) ?? 0,
    user: item.User?.LastName || '',
    vendorCode: item.Product?.VendorCode || item.Product?.Articul || '—',
  }))

  const splitRows = splitItems.map((item) => ({
    amountLocal: item.TotalAmountEurToUah,
    comment: item.Comment || '',
    discount: 0,
    localPrice: getWizardProductNumber(item.Product.CurrentPriceEurToUah) ?? 0,
    name: item.Product.NameUA || item.Product.Name || '—',
    oneTimeDiscount: 0,
    originalNumber: item.Product.MainOriginalNumber || '',
    price: getWizardProductNumber(item.Product.CurrentPrice) ?? 0,
    qty: item.Qty,
    totalAmount: item.TotalAmount,
    user: item.User?.LastName || '',
    vendorCode: item.Product.VendorCode || item.Product.Articul || '—',
  }))

  return (
    <Box
      ref={rootRef}
      style={{
        background: 'var(--mantine-color-body)',
        display: 'flex',
        gap: 12,
        inset: 0,
        overflow: 'auto',
        padding: 4,
        position: 'absolute',
        zIndex: 20,
      }}
    >
      <CartTable
        discountHeader={t('Ручна знижка')}
        list="current"
        localCurrencyCode={localCurrencyCode}
        rows={currentRows}
        selectedIndex={selected?.list === 'current' ? selected.index : null}
        title=""
      />
      {isSplit && (
        <CartTable
          discountHeader={t('Знижка')}
          list="split"
          localCurrencyCode={localCurrencyCode}
          rows={splitRows}
          selectedIndex={selected?.list === 'split' ? selected.index : null}
          title={t('Нова накладна з рахунку')}
        />
      )}
    </Box>
  )
}

type CartTableRow = {
  amountLocal: number
  comment: string
  discount: number
  localPrice: number
  name: string
  oneTimeDiscount: number
  originalNumber: string
  price: number
  qty: number
  totalAmount: number
  user: string
  vendorCode: string
}

function CartTable({
  discountHeader,
  list,
  localCurrencyCode,
  rows,
  selectedIndex,
  title,
}: {
  discountHeader: string
  list: 'current' | 'split'
  localCurrencyCode: string
  rows: CartTableRow[]
  selectedIndex: number | null
  title: string
}) {
  const { t } = useI18n()
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0)
  const totalAmount = roundMoney(rows.reduce((sum, row) => sum + row.totalAmount, 0))
  const totalAmountLocal = roundMoney(rows.reduce((sum, row) => sum + row.amountLocal, 0))

  return (
    <Paper p="xs" radius="md" style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 }} withBorder>
      <Text fw={600} mb={4} mih={22} size="sm">
        {title}
      </Text>
      <ScrollArea style={{ flex: 1 }} type="auto">
        <Table stickyHeader verticalSpacing={4} withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={36} />
              <Table.Th>{t('Код товару')}</Table.Th>
              <Table.Th>{t('Назва')}</Table.Th>
              <Table.Th>{t('Коментар')}</Table.Th>
              <Table.Th>{t('Оригінальний номер')}</Table.Th>
              <Table.Th>{t('Додав')}</Table.Th>
              <Table.Th ta="right">{t('Кількість')}</Table.Th>
              <Table.Th ta="right">EUR</Table.Th>
              <Table.Th ta="right">{localCurrencyCode}</Table.Th>
              <Table.Th ta="right">{t('Сума в EUR')}</Table.Th>
              <Table.Th ta="right">{discountHeader}</Table.Th>
              <Table.Th ta="right">{`${t('Сума в')} ${localCurrencyCode}`}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={12}>
                  <Text c="dimmed" py="sm" size="sm" ta="center">
                    {t('Немає позицій')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row, index) => (
                <Table.Tr
                  key={index}
                  data-cart-row={`${list}-${index}`}
                  style={index === selectedIndex ? { background: 'var(--mantine-color-blue-light)' } : undefined}
                >
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {row.vendorCode}
                    </Text>
                  </Table.Td>
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td>{row.comment}</Table.Td>
                  <Table.Td>{row.originalNumber}</Table.Td>
                  <Table.Td>{row.user}</Table.Td>
                  <Table.Td ta="right">{qtyFormatter.format(row.qty)}</Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(row.price)}</Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(row.localPrice)}</Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(row.totalAmount)}</Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(list === 'current' ? row.oneTimeDiscount : row.discount)}</Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(row.amountLocal)}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Group gap="xl" justify="flex-end" mt={6}>
        <Text size="sm">
          {t('К-сть')}:{' '}
          <Text fw={600} span>
            {qtyFormatter.format(totalQty)}
          </Text>
        </Text>
        <Text size="sm">
          {t('Вся сума')}:{' '}
          <Text fw={600} span>
            {priceFormatter.format(totalAmount)}
          </Text>
        </Text>
        <Text size="sm">
          {`${t('Сума в')} ${localCurrencyCode}`}:{' '}
          <Text fw={700} span>
            {priceFormatter.format(totalAmountLocal)}
          </Text>
        </Text>
      </Group>
    </Paper>
  )
}
