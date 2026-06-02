import { Anchor, Box, Group, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { getVisibleOrderItemBaseDiscount } from '../saleDiscounts'
import { isDiscountEditableSaleLifecycle } from '../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale, SalesUkraineUser } from '../types'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const BASE_CURRENCY_CODE = 'EUR'

export function SaleExpandContent({
  sale,
  onOpenItemDiscount,
}: {
  sale: SalesUkraineSale
  onOpenItemDiscount: (sale: SalesUkraineSale, orderItem: SalesUkraineOrderItem) => void
}) {
  const { t } = useI18n()
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const localCurrencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code || ''
  const canEditDiscount = isDiscountEditableSaleLifecycle(sale.BaseLifeCycleStatus?.SaleLifeCycleType)
  const isVatSale = Boolean(sale.IsVatSale)
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
    <>
      <Stack className="sale-expand-content" gap={0} px="md" py="sm">
        {orderItems.map((orderItem, index) => (
          <SaleExpandContentItem
            key={String(orderItem.NetUid || orderItem.Id || index)}
            canEditDiscount={canEditDiscount}
            isVatSale={isVatSale}
            hasUniformDiscount={hasUniformDiscount}
            localCurrencyCode={localCurrencyCode}
            orderItem={orderItem}
            onOpenItemDiscount={() => onOpenItemDiscount(sale, orderItem)}
            onOpenProductCard={setProductCardNetId}
          />
        ))}
      </Stack>
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </>
  )
}

function SaleExpandContentItem({
  canEditDiscount,
  hasUniformDiscount,
  isVatSale,
  localCurrencyCode,
  onOpenProductCard,
  orderItem,
  onOpenItemDiscount,
}: {
  canEditDiscount: boolean
  hasUniformDiscount: boolean
  isVatSale: boolean
  localCurrencyCode: string
  onOpenProductCard: (productNetId: string) => void
  orderItem: SalesUkraineOrderItem
  onOpenItemDiscount: () => void
}) {
  const { t } = useI18n()
  const oneTimeDiscount = getNumber(orderItem.OneTimeDiscount)
  const hasOneTimeDiscount = typeof oneTimeDiscount === 'number' && oneTimeDiscount !== 0
  const baseDiscount = getVisibleOrderItemBaseDiscount(orderItem)
  const productNetId = orderItem.Product?.NetUid
  const openProductCard = productNetId
    ? (event: { stopPropagation: () => void }) => {
        event.stopPropagation()
        onOpenProductCard(productNetId)
      }
    : undefined

  const responsible = getResponsible(orderItem.User)
  const specificationCode = orderItem.AssignedSpecification?.SpecificationCode
  const created = formatDateTime(orderItem.Created)

  const useEurToUah = !isVatSale && localCurrencyCode === BASE_CURRENCY_CODE
  const secondAmount = useEurToUah ? getNumber(orderItem.TotalAmountEurToUah) : getNumber(orderItem.TotalAmount)
  const secondCode = useEurToUah ? 'UAH' : BASE_CURRENCY_CODE
  const overLordQty = getNumber(orderItem.OverLordQty)
  const qty = getNumber(orderItem.Qty)
  const qtyText = overLordQty ? `${displayValue(qty)} / ${overLordQty}` : displayValue(qty)
  const hasQtyOverflow = typeof overLordQty === 'number' && overLordQty !== 0 && qty !== overLordQty
  const comment = orderItem.Comment?.trim()
  const discountUpdater = getResponsible(orderItem.DiscountUpdatedBy)

  return (
    <Group
      align="flex-start"
      className="sale-expand-content-item"
      gap="md"
      justify="space-between"
      px="xs"
      py={8}
      style={hasQtyOverflow ? { backgroundColor: 'var(--mantine-color-red-1)', borderRadius: 6 } : undefined}
      wrap="nowrap"
    >
      <Box style={{ minWidth: 0 }}>
        <Group gap={6} wrap="wrap">
          {openProductCard ? (
            <>
              <Anchor component="button" fw={600} type="button" onClick={openProductCard}>
                {displayValue(getOrderItemProductCode(orderItem))}
              </Anchor>
              <Anchor component="button" type="button" onClick={openProductCard}>
                {displayValue(getOrderItemProductName(orderItem))}
              </Anchor>
            </>
          ) : (
            <>
              <Text fw={600}>{displayValue(getOrderItemProductCode(orderItem))}</Text>
              <Text>{displayValue(getOrderItemProductName(orderItem))}</Text>
            </>
          )}
          {orderItem.Product?.MainOriginalNumber && (
            <Text c="dimmed">{orderItem.Product.MainOriginalNumber}</Text>
          )}
        </Group>
        <Group gap={10} wrap="wrap" mt={2}>
          {created && (
            <Text c="dimmed" size="xs">
              {t('Від')} {created}
            </Text>
          )}
          {responsible && (
            <Text c="dimmed" size="xs">
              {responsible}
            </Text>
          )}
          {specificationCode && (
            <Text c="dimmed" size="xs">
              {t('Митний код')}: {specificationCode}
            </Text>
          )}
        </Group>
        {comment && (
          <Text c="dimmed" fs="italic" mt={2} size="xs">
            {comment}
          </Text>
        )}
      </Box>

      <Group align="flex-start" gap="lg" wrap="nowrap">
        <ValueBlock label={localCurrencyCode || t('Сума')} value={formatAmount(getNumber(orderItem.TotalAmountLocal))} />
        <ValueBlock label={secondCode} value={formatAmount(secondAmount)} />
        {isVatSale && <ValueBlock label={t('ПДВ')} value={formatAmount(getNumber(orderItem.TotalVat))} />}
        <ValueBlock label={t('Count')} value={qtyText} />
        <ValueBlock label={t('Базова знижка')} value={formatPercent(baseDiscount)} />

        <Box style={{ minWidth: 72, textAlign: 'right' }}>
          <Text size="xs" c="dimmed" tt="uppercase">
            {t('Разова знижка')}
          </Text>
          {!hasUniformDiscount && canEditDiscount ? (
            <Anchor
              component="button"
              fw={hasOneTimeDiscount ? 600 : 400}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenItemDiscount()
              }}
            >
              {hasOneTimeDiscount ? formatPercent(oneTimeDiscount) : t('Знижка')}
            </Anchor>
          ) : (
            <Text>{hasOneTimeDiscount ? formatPercent(oneTimeDiscount) : '—'}</Text>
          )}
          {hasOneTimeDiscount && discountUpdater && (
            <Text c="dimmed" size="xs">
              {discountUpdater}
            </Text>
          )}
        </Box>
      </Group>
    </Group>
  )
}

function ValueBlock({ label, value }: { label: string; value: string }) {
  return (
    <Box style={{ minWidth: 96, textAlign: 'right' }}>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
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

function getResponsible(user?: SalesUkraineUser | null): string {
  return user?.LastName?.trim() || user?.FullName?.trim() || [user?.LastName, user?.FirstName].filter(Boolean).join(' ').trim() || ''
}

function formatAmount(value: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : displayValue(value)
}

function formatPercent(value: number | null): string {
  return typeof value === 'number' ? `${amountFormatter.format(value)} %` : '—'
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : ''
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}.${month}.${date.getFullYear()} ${hours}:${minutes}`
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
