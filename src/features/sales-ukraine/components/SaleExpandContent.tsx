import { Anchor, Box, Group, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../types'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const NEW_LIFECYCLE_TYPE = 0

export function SaleExpandContent({
  sale,
  onOpenItemDiscount,
}: {
  sale: SalesUkraineSale
  onOpenItemDiscount: (sale: SalesUkraineSale, orderItem: SalesUkraineOrderItem) => void
}) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const localCurrencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code || ''
  const isNew = sale.BaseLifeCycleStatus?.SaleLifeCycleType === NEW_LIFECYCLE_TYPE
  const hasUniformDiscount = hasUniformOrderItemDiscount(orderItems)

  if (!orderItems.length) {
    return (
      <Box className="sale-expand-content" px="md" py="sm">
        <Text size="sm" c="dimmed">
          {t('Товарів не знайдено')}
        </Text>
      </Box>
    )
  }

  return (
    <Stack className="sale-expand-content" gap={0} px="md" py="sm">
      {orderItems.map((orderItem, index) => (
        <SaleExpandContentItem
          key={String(orderItem.NetUid || orderItem.Id || index)}
          isNew={isNew}
          hasUniformDiscount={hasUniformDiscount}
          localCurrencyCode={localCurrencyCode}
          orderItem={orderItem}
          onOpenItemDiscount={() => onOpenItemDiscount(sale, orderItem)}
        />
      ))}
    </Stack>
  )
}

function SaleExpandContentItem({
  hasUniformDiscount,
  isNew,
  localCurrencyCode,
  orderItem,
  onOpenItemDiscount,
}: {
  hasUniformDiscount: boolean
  isNew: boolean
  localCurrencyCode: string
  orderItem: SalesUkraineOrderItem
  onOpenItemDiscount: () => void
}) {
  const { t } = useI18n()
  const discount = getNumber(orderItem.OneTimeDiscount)
  const hasDiscount = typeof discount === 'number' && discount !== 0

  return (
    <Group
      align="flex-start"
      className="sale-expand-content-item"
      gap="md"
      justify="space-between"
      py={8}
      wrap="nowrap"
    >
      <Box style={{ minWidth: 0 }}>
        <Group gap={6} wrap="wrap">
          <Text fw={600}>{displayValue(getOrderItemProductCode(orderItem))}</Text>
          <Text>{displayValue(getOrderItemProductName(orderItem))}</Text>
          {orderItem.Product?.MainOriginalNumber && (
            <Text c="dimmed">{orderItem.Product.MainOriginalNumber}</Text>
          )}
        </Group>
      </Box>

      <Group align="flex-start" gap="lg" wrap="nowrap">
        <ValueBlock label={t('Ціна')} value={formatAmount(getNumber(orderItem.PricePerItem))} suffix={localCurrencyCode} />
        <ValueBlock
          label={t('Сума')}
          value={formatAmount(getNumber(orderItem.TotalAmountLocal) ?? getNumber(orderItem.TotalAmount))}
          suffix={localCurrencyCode}
        />
        <ValueBlock label={t('Count')} value={displayValue(getNumber(orderItem.Qty))} />

        <Box style={{ minWidth: 72, textAlign: 'right' }}>
          <Text size="xs" c="dimmed" tt="uppercase">
            {t('Знижка')}
          </Text>
          {!hasUniformDiscount && (hasDiscount || isNew) ? (
            <Anchor
              component="button"
              fw={hasDiscount ? 600 : 400}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenItemDiscount()
              }}
            >
              {hasDiscount ? `${amountFormatter.format(discount)} %` : t('Знижка')}
            </Anchor>
          ) : (
            <Text>{hasDiscount ? `${amountFormatter.format(discount)} %` : '—'}</Text>
          )}
        </Box>
      </Group>
    </Group>
  )
}

function ValueBlock({ label, suffix, value }: { label: string; suffix?: string; value: string }) {
  return (
    <Box style={{ minWidth: 96, textAlign: 'right' }}>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
      {suffix ? (
        <Text size="xs" c="dimmed">
          {suffix}
        </Text>
      ) : null}
    </Box>
  )
}

function hasUniformOrderItemDiscount(orderItems: SalesUkraineOrderItem[]): boolean {
  if (!orderItems.length) {
    return false
  }

  const firstDiscount = getNumber(orderItems[0]?.OneTimeDiscount)

  if (typeof firstDiscount !== 'number' || firstDiscount === 0) {
    return false
  }

  return orderItems.every((item) => getNumber(item.OneTimeDiscount) === firstDiscount)
}

function getOrderItemProductName(item: SalesUkraineOrderItem): string {
  return item.Product?.NameUA || item.Product?.Name || ''
}

function getOrderItemProductCode(item: SalesUkraineOrderItem): string {
  return item.Product?.VendorCode || item.Product?.Articul || item.Product?.MainOriginalNumber || ''
}

function formatAmount(value: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : displayValue(value)
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  if (typeof value === 'string') {
    return value.trim() || '—'
  }

  return '—'
}
