import { Badge, Box, Group, Image, Stack, Text, ThemeIcon } from '@mantine/core'
import { Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getRetailItemAvailableQty,
  getRetailItemBrand,
  getRetailItemImage,
  getRetailItemKey,
  getRetailItemLocalCurrencyCode,
  getRetailItemMainOriginalNumber,
  getRetailItemProductName,
  getRetailItemQuantity,
  getRetailItemSourceCurrencyCode,
  getRetailItemSourceUnitPrice,
  getRetailItemTotal,
  getRetailItemUnitPrice,
  getRetailItemVendorCode,
} from '../onlineShopDisplay'
import type { RetailCartItem } from '../onlineShopTypes'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const quantityFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

type OnlineShopOrderItemsListProps = {
  currencyCode?: string
  emptyText: string
  items: RetailCartItem[]
}

export function OnlineShopOrderItemsList({ currencyCode, emptyText, items }: OnlineShopOrderItemsListProps) {
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
        <CartItemRow key={getRetailItemKey(item, index)} currencyCode={currencyCode} item={item} />
      ))}
    </Stack>
  )
}

function CartItemRow({ currencyCode, item }: { currencyCode?: string; item: RetailCartItem }) {
  const { t } = useI18n()
  const product = item.Product
  const image = getRetailItemImage(item, product)
  const productName = displayValue(getRetailItemProductName(item, product))
  const vendorCode = getRetailItemVendorCode(item, product)
  const originalNumber = getRetailItemMainOriginalNumber(product)
  const brand = getRetailItemBrand(product)
  const availableQty = getRetailItemAvailableQty(product)
  const quantity = getRetailItemQuantity(item)
  const unitPrice = getRetailItemUnitPrice(item)
  const total = getRetailItemTotal(item)
  const localCurrencyCode = getRetailItemLocalCurrencyCode(item, currencyCode)
  const sourceCurrencyCode = getRetailItemSourceCurrencyCode(item, product)
  const sourceUnitPrice = getRetailItemSourceUnitPrice(item, product)

  return (
    <Group className="online-shop-order-item-row" align="flex-start" gap="sm" wrap="nowrap">
      <CartItemImage image={image} name={productName} />
      <Box className="online-shop-order-item-copy" flex={1}>
        <Text className="online-shop-order-item-title" fw={600} lineClamp={2} size="sm">
          {productName}
        </Text>
        <div className="online-shop-order-item-identifiers">
          {vendorCode ? <span>{vendorCode}</span> : null}
          {originalNumber ? <span>OE {originalNumber}</span> : null}
        </div>
        {(brand || availableQty !== null) && (
          <div className="online-shop-order-item-details">
            {brand ? <span>{brand}</span> : null}
            {availableQty !== null ? (
              <span>{t('В наявності')}: {formatQuantity(availableQty)}</span>
            ) : null}
          </div>
        )}
        <Group className="online-shop-order-item-meta" gap="xs" mt={4}>
          <Badge className="online-shop-order-item-quantity" color="gray" variant="light">
            {formatQuantity(quantity)} {t('шт.')}
          </Badge>
          <Text className="online-shop-order-item-unit-price" c="dimmed" size="xs">
            <strong className="app-money app-money-meta">{formatAmount(unitPrice)}</strong> <span>{localCurrencyCode}</span> / {t('шт.')}
          </Text>
          {sourceUnitPrice !== null && sourceCurrencyCode && sourceCurrencyCode !== localCurrencyCode ? (
            <Text className="online-shop-order-item-source-price" c="dimmed" size="xs">
              <strong className="app-money app-money-meta">{formatAmount(sourceUnitPrice)}</strong> <span>{sourceCurrencyCode}</span>
            </Text>
          ) : null}
        </Group>
      </Box>
      <div className="online-shop-order-item-total">
        <strong className="app-money">{formatAmount(total)}</strong>
        <span>{localCurrencyCode}</span>
      </div>
    </Group>
  )
}

function CartItemImage({ image, name }: { image: string; name: string }) {
  const [hasError, setHasError] = useState(false)

  if (!image || hasError) {
    return (
      <ThemeIcon className="online-shop-order-item-image" color="gray" h={64} radius="sm" variant="light" w={64}>
        <ImageIcon size={22} />
      </ThemeIcon>
    )
  }

  return (
    <Image
      alt={name}
      className="online-shop-order-item-image"
      fit="contain"
      h={64}
      loading="lazy"
      radius="sm"
      src={image}
      w={64}
      onError={() => setHasError(true)}
    />
  )
}

function formatAmount(value: number): string {
  return amountFormatter.format(value)
}

function formatQuantity(value: number): string {
  return quantityFormatter.format(value)
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
