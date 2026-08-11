import { useMemo, useState } from 'react'
import { Anchor, Badge, Stack, Text } from '@mantine/core'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CartReserveOrderItem, ShoppingCartReserveItem } from '../types'
import {
  formatCartDate,
  formatCartTime,
  formatExchangeRate,
  formatMoney,
  formatQty,
  getCartClientName,
  getCartCurrencyCode,
  getCartKey,
  getCartLocalCurrencyCode,
  getCartUahAmount,
  getDaysRemaining,
  getOrderItemAmount,
  getOrderItemAmountCurrency,
  getOrderItemKey,
} from '../utils'

const TABLE_LAYOUT = {
  density: 'normal',
} satisfies DataTableDefaultLayout

type CartReserveTableProps = {
  carts: ShoppingCartReserveItem[]
  isLoading: boolean
  onOpenClient: (cart: ShoppingCartReserveItem) => void
}

export function CartReserveTable({ carts, isLoading, onOpenClient }: CartReserveTableProps) {
  const { t } = useI18n()
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const columns = useCartColumns(onOpenClient)

  return (
    <div className="cart-reserve-table">
      <DataTable
        columns={columns}
        data={carts}
        defaultLayout={TABLE_LAYOUT}
        distributeAvailableWidth
        emptyText={t('Кошиків не знайдено')}
        expandColumnLabels={{
          collapseRow: t('Згорнути позиції'),
          expandRow: t('Розгорнути позиції'),
        }}
        getRowCanExpand={(cart) => Boolean(cart.OrderItems?.length)}
        getRowId={getCartKey}
        isLoading={isLoading}
        layoutVersion="shopping-cart-reserve-summary-1"
        minWidth={880}
        showDensityToggle={false}
        showLayoutControls={false}
        tableId="shopping-cart-reserve-summary"
        renderExpandedRow={(cart) => (
          <CartReserveItems
            cart={cart}
            onOpenProductCard={setProductCardNetId}
          />
        )}
      />
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </div>
  )
}

function useCartColumns(onOpenClient: (cart: ShoppingCartReserveItem) => void) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ShoppingCartReserveItem>[]>(
    () => [
      {
        id: 'client',
        header: t('Клієнт'),
        width: 430,
        minWidth: 280,
        fill: true,
        accessor: (cart) => getCartClientName(cart),
        cell: (cart) => {
          const clientName = getCartClientName(cart)

          return (
            <Anchor
              className="cart-reserve-client-link"
              component="button"
              type="button"
              underline="never"
              onClick={(event) => {
                event.stopPropagation()
                onOpenClient(cart)
              }}
            >
              {clientName || t('Без назви')}
            </Anchor>
          )
        },
      },
      {
        id: 'validUntil',
        header: t('Дійсно до'),
        width: 150,
        minWidth: 130,
        accessor: (cart) => cart.ValidUntil ? new Date(cart.ValidUntil).getTime() : 0,
        cell: (cart) => <Text className="cart-reserve-validity">{formatCartDate(cart.ValidUntil) || '—'}</Text>,
      },
      {
        id: 'amount',
        header: `${t('Сума')}, ${getCartCurrencyCode()}`,
        width: 170,
        minWidth: 150,
        align: 'right',
        accessor: (cart) => cart.TotalAmount ?? 0,
        cell: (cart) => (
          <Text className="app-money cart-reserve-summary-amount">
            {formatMoney(cart.TotalAmount)} <span>{getCartCurrencyCode()}</span>
          </Text>
        ),
      },
      {
        id: 'localAmount',
        header: `${t('Сума')}, UAH`,
        width: 180,
        minWidth: 160,
        align: 'right',
        accessor: (cart) => getCartUahAmount(cart) ?? Number.MIN_SAFE_INTEGER,
        cell: (cart) => (
          <Text className="app-money cart-reserve-summary-amount">
            {formatMoney(getCartUahAmount(cart))} <span>UAH</span>
          </Text>
        ),
      },
      {
        id: 'daysRemaining',
        header: t('Залишилось днів'),
        width: 145,
        minWidth: 130,
        align: 'center',
        accessor: (cart) => getDaysRemaining(cart.ValidUntil) ?? Number.MIN_SAFE_INTEGER,
        cell: (cart) => {
          const daysRemaining = getDaysRemaining(cart.ValidUntil)

          return (
            <Badge className={`app-role-pill ${getDaysPillClass(daysRemaining)}`} variant="light">
              {daysRemaining == null ? '—' : daysRemaining}
            </Badge>
          )
        },
      },
    ],
    [onOpenClient, t],
  )
}

function CartReserveItems({
  cart,
  onOpenProductCard,
}: {
  cart: ShoppingCartReserveItem
  onOpenProductCard: (productNetId: string) => void
}) {
  const { t } = useI18n()
  const localCurrencyCode = getCartLocalCurrencyCode(cart)
  const columns = useCartItemColumns(localCurrencyCode, onOpenProductCard)

  return (
    <div className="cart-reserve-items-frame">
      <div className="cart-reserve-items-heading">
        <Text className="cart-reserve-items-title">{t('Позиції')}</Text>
        <Badge className="app-role-pill is-gray" variant="light">
          {cart.OrderItems?.length || 0}
        </Badge>
      </div>
      <DataTable
        columns={columns}
        data={cart.OrderItems || []}
        defaultLayout={TABLE_LAYOUT}
        distributeAvailableWidth
        emptyText={t('Позицій не знайдено')}
        getRowId={getOrderItemKey}
        layoutVersion="shopping-cart-reserve-items-3"
        minWidth={1100}
        showDensityToggle={false}
        showLayoutControls={false}
        tableId={`shopping-cart-reserve-items-${cart.NetUid || 'cart'}`}
      />
    </div>
  )
}

function getDaysPillClass(daysRemaining: number | null): string {
  if (daysRemaining == null) {
    return 'is-gray'
  }

  if (daysRemaining <= 0) {
    return 'is-red'
  }

  if (daysRemaining <= 3) {
    return 'is-orange'
  }

  return 'is-green'
}

function useCartItemColumns(localCurrencyCode: string, onOpenProductCard: (productNetId: string) => void) {
  return useMemo<DataTableColumn<CartReserveOrderItem>[]>(
    () => [
      {
        id: 'vendorCode',
        header: 'Код виробника',
        width: 150,
        minWidth: 120,
        accessor: (item) => item.Product?.VendorCode || '',
        cell: (item) => {
          const netId = item.Product?.NetUid
          const code = item.Product?.VendorCode || ''

          return netId ? (
            <Anchor
              className="cart-reserve-code-link"
              component="button"
              title={code}
              type="button"
              underline="always"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              {code}
            </Anchor>
          ) : (
            <Text className="cart-reserve-mono-cell" title={code}>{code}</Text>
          )
        },
      },
      {
        id: 'name',
        header: 'Назва',
        width: 280,
        minWidth: 200,
        accessor: (item) => item.Product?.Name || '',
        cell: (item) => (
          <Stack gap={0}>
            {item.Product?.NetUid ? (
              <Anchor
                className="cart-reserve-product-link"
                component="button"
                title={item.Product?.Name || ''}
                type="button"
                underline="always"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenProductCard(item.Product?.NetUid as string)
                }}
              >
                {item.Product?.Name || ''}
              </Anchor>
            ) : (
              <Text className="cart-reserve-product-name" title={item.Product?.Name || ''}>{item.Product?.Name || ''}</Text>
            )}
            {item.Comment ? (
              <Text className="cart-reserve-comment" lineClamp={1} title={item.Comment}>
                {item.Comment}
              </Text>
            ) : null}
          </Stack>
        ),
      },
      {
        id: 'originalNumber',
        header: 'Оригінальний номер',
        width: 180,
        minWidth: 140,
        accessor: (item) => item.Product?.MainOriginalNumber || '',
        cell: (item) => <Text className="cart-reserve-mono-cell" title={item.Product?.MainOriginalNumber || ''}>{item.Product?.MainOriginalNumber || ''}</Text>,
      },
      {
        id: 'created',
        header: 'Дата',
        width: 150,
        minWidth: 130,
        accessor: (item) => (item.Created ? new Date(item.Created).getTime() : 0),
        cell: (item) => (
          <Stack gap={0}>
            <Text className="cart-reserve-date-cell">{formatCartDate(item.Created) || ''}</Text>
            <Text className="cart-reserve-time-cell">{formatCartTime(item.Created)}</Text>
          </Stack>
        ),
      },
      {
        id: 'seller',
        header: 'Продавець',
        width: 150,
        minWidth: 120,
        accessor: (item) => item.User?.LastName || '',
        cell: (item) => item.User?.LastName || '',
      },
      {
        id: 'specificationCode',
        header: 'Код специфікації',
        width: 160,
        minWidth: 130,
        accessor: (item) => item.AssignedSpecification?.SpecificationCode || '',
        cell: (item) => <Text className="cart-reserve-mono-cell" title={item.AssignedSpecification?.SpecificationCode || ''}>{item.AssignedSpecification?.SpecificationCode || ''}</Text>,
      },
      {
        id: 'qty',
        header: 'К-сть',
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (item) => item.Qty ?? 0,
        cell: (item) => <Text className="cart-reserve-number-cell">{formatQty(item)}</Text>,
      },
      {
        id: 'amount',
        header: 'Сума',
        width: 160,
        minWidth: 130,
        align: 'right',
        accessor: (item) => getOrderItemAmount(item, localCurrencyCode),
        cell: (item) => (
          <Stack gap={0} align="flex-end">
            <Text className="app-money" fw={600} size="sm">
              {formatMoney(item.TotalAmountLocal)} {localCurrencyCode}
            </Text>
            <Text className="app-money app-money-meta" size="xs">
              {formatMoney(getOrderItemAmount(item, localCurrencyCode))} {getOrderItemAmountCurrency(localCurrencyCode)}
            </Text>
            <Text className="app-money app-money-meta" size="xs">
              Курс EUR→UAH: {formatExchangeRate(item.Product?.CurrentEurToUahExchangeRate)}
            </Text>
          </Stack>
        ),
      },
    ],
    [localCurrencyCode, onOpenProductCard],
  )
}
