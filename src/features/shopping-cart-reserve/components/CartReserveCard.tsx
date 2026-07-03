import { useMemo, useState } from 'react'
import { ActionIcon, Anchor, Badge, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CartReserveOrderItem, ShoppingCartReserveItem } from '../types'
import {
  formatCartDate,
  formatCartTime,
  formatMoney,
  formatQty,
  getCartClientName,
  getCartCurrencyCode,
  getCartLocalCurrencyCode,
  getDaysRemaining,
  getOrderItemAmount,
  getOrderItemAmountCurrency,
  getOrderItemKey,
} from '../utils'

const CART_ITEMS_LAYOUT = {
  density: 'compact',
} satisfies DataTableDefaultLayout

type CartReserveCardProps = {
  cart: ShoppingCartReserveItem
  index: number
  isExpanded: boolean
  onOpenClient: (cart: ShoppingCartReserveItem) => void
  onToggle: (index: number) => void
}

export function CartReserveCard({ cart, index, isExpanded, onOpenClient, onToggle }: CartReserveCardProps) {
  const { t } = useI18n()
  const localCurrencyCode = getCartLocalCurrencyCode(cart)
  const daysRemaining = getDaysRemaining(cart.ValidUntil)
  const clientName = getCartClientName(cart)
  const orderItems = cart.OrderItems || []
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const columns = useCartItemColumns(localCurrencyCode, setProductCardNetId)

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2}>
            <Anchor fw={700} onClick={() => onOpenClient(cart)}>
              {clientName || t('Без назви')}
            </Anchor>
            <Text size="xs" c="dimmed">
              {t('Дійсно до')}: {formatCartDate(cart.ValidUntil)}
            </Text>
          </Stack>

          <Group gap="sm" align="center" wrap="nowrap">
            <Stack gap={2} align="flex-end">
              <Text fw={700}>
                {formatMoney(cart.TotalAmount)} {getCartCurrencyCode()}
              </Text>
              <Text size="sm" c="dimmed">
                {formatMoney(cart.TotalLocalAmount)} {localCurrencyCode}
              </Text>
            </Stack>

            <Badge color={getDaysColor(daysRemaining)} variant="light">
              {daysRemaining == null
                ? ''
                : `${t('Залишилось днів')}: ${daysRemaining}`}
            </Badge>

            <ActionIcon
              variant="light"
              color="gray"
              aria-label={isExpanded ? t('Згорнути') : t('Розгорнути')}
              onClick={() => onToggle(index)}
            >
              {isExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
            </ActionIcon>
          </Group>
        </Group>

        {isExpanded && (
          <DataTable
            columns={columns}
            data={orderItems}
            defaultLayout={CART_ITEMS_LAYOUT}
            distributeAvailableWidth
            emptyText={t('Позицій не знайдено')}
            getRowId={getOrderItemKey}
            layoutVersion="shopping-cart-reserve-items-2"
            minWidth={1100}
            tableId={`shopping-cart-reserve-items-${cart.NetUid || index}`}
          />
        )}
      </Stack>
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Card>
  )
}

function getDaysColor(daysRemaining: number | null): string {
  if (daysRemaining == null) {
    return 'gray'
  }

  if (daysRemaining <= 0) {
    return 'red'
  }

  if (daysRemaining <= 3) {
    return 'orange'
  }

  return 'green'
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
              component="button"
              fw={600}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              {code}
            </Anchor>
          ) : (
            <Text fw={600}>{code}</Text>
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
                component="button"
                size="sm"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenProductCard(item.Product?.NetUid as string)
                }}
              >
                {item.Product?.Name || ''}
              </Anchor>
            ) : (
              <Text size="sm">{item.Product?.Name || ''}</Text>
            )}
            {item.Comment ? (
              <Tooltip label={item.Comment} position="top" multiline maw={320}>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {item.Comment}
                </Text>
              </Tooltip>
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
        cell: (item) => item.Product?.MainOriginalNumber || '',
      },
      {
        id: 'created',
        header: 'Дата',
        width: 150,
        minWidth: 130,
        accessor: (item) => (item.Created ? new Date(item.Created).getTime() : 0),
        cell: (item) => (
          <Stack gap={0}>
            <Text size="sm">{formatCartDate(item.Created) || ''}</Text>
            <Text size="xs" c="dimmed">
              {formatCartTime(item.Created)}
            </Text>
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
        cell: (item) => item.AssignedSpecification?.SpecificationCode || '',
      },
      {
        id: 'qty',
        header: 'К-сть',
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (item) => item.Qty ?? 0,
        cell: (item) => formatQty(item),
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
            <Text fw={600}>
              {formatMoney(item.TotalAmountLocal)} {localCurrencyCode}
            </Text>
            <Text size="xs" c="dimmed">
              {formatMoney(getOrderItemAmount(item, localCurrencyCode))} {getOrderItemAmountCurrency(localCurrencyCode)}
            </Text>
          </Stack>
        ),
      },
    ],
    [localCurrencyCode, onOpenProductCard],
  )
}
