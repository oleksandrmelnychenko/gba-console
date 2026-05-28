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
    <Stack gap="sm">
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
    <Group align="flex-start" gap="sm" wrap="nowrap">
      {image ? (
        <Image h={56} radius="sm" src={image} w={56} />
      ) : (
        <ThemeIcon color="gray" h={56} radius="sm" variant="light" w={56}>
          <IconPhoto size={22} />
        </ThemeIcon>
      )}
      <Box flex={1}>
        <Text fw={600} lineClamp={2} size="sm">
          {displayValue(getRetailItemProductName(item, product))}
        </Text>
        <Text c="dimmed" size="xs">
          {displayValue(getRetailItemVendorCode(item, product))}
        </Text>
        <Group gap="xs" mt={4}>
          <Badge color="gray" variant="light">
            {quantity} {t('шт.')}
          </Badge>
          <Text c="dimmed" size="xs">
            {formatAmount(unitPrice)}
          </Text>
        </Group>
      </Box>
      <Text fw={700} size="sm">
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
