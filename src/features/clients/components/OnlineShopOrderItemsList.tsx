import { Badge, Box, Group, Image, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getRetailItemImage,
  getRetailItemKey,
  getRetailItemProductName,
  getRetailItemQuantity,
  getRetailItemTotal,
  getRetailItemUnitPrice,
  getRetailItemVendorCode,
} from '../onlineShopDisplay'
import type { RetailCartItem } from '../onlineShopTypes'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type OnlineShopOrderItemsListProps = {
  emptyText: string
  items: RetailCartItem[]
}

export function OnlineShopOrderItemsList({ emptyText, items }: OnlineShopOrderItemsListProps) {
  const { t } = useI18n()

  if (items.length === 0) {
    return (
      <Text ta="center" c="dimmed" py="xl">
        {t(emptyText)}
      </Text>
    )
  }

  return (
    <Stack className="online-shop-order-items-list" gap="sm">
      {items.map((item, index) => (
        <CartItemRow key={getRetailItemKey(item, index)} item={item} />
      ))}
    </Stack>
  )
}

function CartItemRow({ item }: { item: RetailCartItem }) {
  const { t } = useI18n()
  const product = item.Product
  const image = getRetailItemImage(item, product)
  const quantity = getRetailItemQuantity(item)
  const unitPrice = getRetailItemUnitPrice(item)
  const total = getRetailItemTotal(item)

  return (
    <Group className="online-shop-order-item-row" align="flex-start" gap="sm" wrap="nowrap">
      {image ? (
        <Image className="online-shop-order-item-image" h={56} radius="sm" src={image} w={56} />
      ) : (
        <ThemeIcon className="online-shop-order-item-image" color="gray" h={56} radius="sm" variant="light" w={56}>
          <IconPhoto size={22} />
        </ThemeIcon>
      )}
      <Box className="online-shop-order-item-copy" flex={1}>
        <Text className="online-shop-order-item-title" fw={600} lineClamp={2} size="sm">
          {displayValue(getRetailItemProductName(item, product))}
        </Text>
        <Text className="online-shop-order-item-code" c="dimmed" size="xs">
          {displayValue(getRetailItemVendorCode(item, product))}
        </Text>
        <Group className="online-shop-order-item-meta" gap="xs" mt={4}>
          <Badge className="online-shop-order-item-quantity" color="gray" variant="light">
            {quantity} {t('шт.')}
          </Badge>
          <Text className="online-shop-order-item-unit-price" c="dimmed" size="xs">
            {formatAmount(unitPrice)}
          </Text>
        </Group>
      </Box>
      <Text className="online-shop-order-item-total" fw={700} size="sm">
        {formatAmount(total)}
      </Text>
    </Group>
  )
}

function formatAmount(value: number): string {
  return amountFormatter.format(value)
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
