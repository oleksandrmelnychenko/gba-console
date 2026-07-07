import { Anchor, Box, Text, Tooltip } from '@mantine/core'
import { Box as BoxIcon } from 'lucide-react'
import { memo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import {
  getOrderItemBaseDiscountSuppressionReason,
  getUniformOneTimeDiscount,
  getVisibleOrderItemBaseDiscount,
  type OrderItemBaseDiscountSuppressionReason,
} from '../saleDiscounts'
import { isDiscountEditableSaleLifecycle } from '../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale, SalesUkraineUser } from '../types'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const BASE_CURRENCY_CODE = 'EUR'

// Memoized: expanding/collapsing one row (or any page-level state change) must
// not re-render every other expanded instance. onOpenItemDiscount is ref-routed
// in the pages, so props stay identity-stable.
export const SaleExpandContent = memo(function SaleExpandContent({
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
  const hasUniformDiscount = getUniformOneTimeDiscount(orderItems) != null
  const useEurToUah = !isVatSale && localCurrencyCode === BASE_CURRENCY_CODE
  const secondCode = useEurToUah ? 'UAH' : BASE_CURRENCY_CODE
  if (!orderItems.length) {
    return (
      <Box className="sale-expand-content is-empty">
        <Text size="sm" c="dimmed">
          {t('Товарів не знайдено')}
        </Text>
      </Box>
    )
  }

  return (
    <>
      <div
        className="sale-expand-content"
        data-vat={isVatSale ? 'true' : 'false'}
        role="table"
        aria-label={t('Товари продажу')}
      >
        <div className="sale-expand-content-head" role="row">
          <span role="columnheader">{t('Товар')}</span>
          <span role="columnheader">{t('К-сть')}</span>
          <span role="columnheader">{localCurrencyCode || t('Сума')}</span>
          <span role="columnheader">{secondCode}</span>
          {isVatSale && <span role="columnheader">{t('ПДВ')}</span>}
          <span role="columnheader">{t('Знижки')}</span>
        </div>
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
      </div>
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </>
  )
})

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
  const baseDiscountSuppressionReason = getOrderItemBaseDiscountSuppressionReason(orderItem)
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
  const localAmountText = formatAmount(getNumber(orderItem.TotalAmountLocal))
  const secondAmountText = formatAmount(secondAmount)
  const overLoadQty = getNumber(orderItem.OverLoadQty)
  const qty = getNumber(orderItem.Qty)
  const qtyText = overLoadQty ? `${displayValue(qty)} / ${overLoadQty}` : displayValue(qty)
  const hasQtyOverflow = typeof overLoadQty === 'number' && overLoadQty !== 0 && qty !== overLoadQty
  const comment = orderItem.Comment?.trim()
  const discountUpdater = getResponsible(orderItem.DiscountUpdatedBy)

  return (
    <div className={`sale-expand-content-item${hasQtyOverflow ? ' is-qty-warning' : ''}`} role="row">
      <div className="sale-expand-product-cell" role="cell">
        <span className="sale-expand-product-icon" aria-hidden="true">
          <BoxIcon size={14} strokeWidth={1.7} />
        </span>
        <div className="sale-expand-product-copy">
          <div className="sale-expand-product-main">
            {openProductCard ? (
              <>
                <Anchor
                  className="sale-expand-product-code"
                  component="button"
                  title={displayValue(getOrderItemProductCode(orderItem))}
                  type="button"
                  onClick={openProductCard}
                >
                  {displayValue(getOrderItemProductCode(orderItem))}
                </Anchor>
                <Anchor
                  className="sale-expand-product-name"
                  component="button"
                  title={displayValue(getOrderItemProductName(orderItem))}
                  type="button"
                  onClick={openProductCard}
                >
                  {displayValue(getOrderItemProductName(orderItem))}
                </Anchor>
              </>
            ) : (
              <>
                <span className="sale-expand-product-code" title={displayValue(getOrderItemProductCode(orderItem))}>
                  {displayValue(getOrderItemProductCode(orderItem))}
                </span>
                <span className="sale-expand-product-name" title={displayValue(getOrderItemProductName(orderItem))}>
                  {displayValue(getOrderItemProductName(orderItem))}
                </span>
              </>
            )}
          </div>
          <div className="sale-expand-product-meta">
            {orderItem.Product?.MainOriginalNumber && (
              <span className="sale-expand-product-meta-value is-number" title={orderItem.Product.MainOriginalNumber}>
                <strong>{orderItem.Product.MainOriginalNumber}</strong>
              </span>
            )}
            {created && (
              <span className="sale-expand-product-meta-value">
                <span>{t('Від')}</span>
                <strong>{created}</strong>
              </span>
            )}
            {responsible && (
              <span className="sale-expand-product-meta-value" title={responsible}>
                <span>{t('Менеджер')}</span>
                <strong>{responsible}</strong>
              </span>
            )}
            {specificationCode && (
              <span className="sale-expand-product-meta-value is-strong">
                <span>{t('Митний код')}</span>
                <strong>{specificationCode}</strong>
              </span>
            )}
          </div>
          {comment && (
            <div className="sale-expand-product-comment" title={comment}>
              {comment}
            </div>
          )}
        </div>
      </div>

      <ValueBlock isQuantityAccent isWarning={hasQtyOverflow} value={qtyText} />
      <ValueBlock value={localAmountText} />
      <ValueBlock value={secondAmountText} />
      {isVatSale && <ValueBlock value={formatAmount(getNumber(orderItem.TotalVat))} />}

      <div className="sale-expand-discount-cell" role="cell">
        <div className="sale-expand-discount-line">
          <span>{t('База')}</span>
          {baseDiscountSuppressionReason ? (
            <Tooltip label={getBaseDiscountSuppressionTooltip(baseDiscountSuppressionReason, t)}>
              <strong className="is-suppressed">{formatPercent(baseDiscount)}</strong>
            </Tooltip>
          ) : (
            <strong>{formatPercent(baseDiscount)}</strong>
          )}
        </div>
        <div className="sale-expand-discount-line">
          <span>{t('Разова')}</span>
          {!hasUniformDiscount && canEditDiscount ? (
            <Anchor
              className="sale-expand-discount-action"
              c="dark.8"
              component="button"
              title={t('Знижка')}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenItemDiscount()
              }}
            >
              {formatPercent(oneTimeDiscount ?? 0)}
            </Anchor>
          ) : (
            <strong>{formatPercent(oneTimeDiscount ?? 0)}</strong>
          )}
        </div>
        {hasOneTimeDiscount && discountUpdater && (
          <div className="sale-expand-discount-user" title={discountUpdater}>
            {discountUpdater}
          </div>
        )}
      </div>
    </div>
  )
}

function getBaseDiscountSuppressionTooltip(
  reason: OrderItemBaseDiscountSuppressionReason,
  t: (value: string) => string,
): string {
  if (reason === 'x9') {
    return t('Базова знижка не показується для товарів Top X9')
  }

  if (reason === 'zero-sale') {
    return t('Базова знижка не показується для товарів з нульовим продажем')
  }

  return t('Базова знижка не показується для акційних товарів')
}

function ValueBlock({
  isQuantityAccent = false,
  isWarning = false,
  value,
}: {
  isQuantityAccent?: boolean
  isWarning?: boolean
  value: string
}) {
  return (
    <div
      className={`sale-expand-value-cell${isQuantityAccent ? ' is-quantity-accent' : ''}${isWarning ? ' is-warning' : ''}`}
      role="cell"
    >
      <strong>{value}</strong>
    </div>
  )
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
  return typeof value === 'number' ? `${amountFormatter.format(value)} %` : ''
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
    return Number.isFinite(value) ? String(value) : ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  return ''
}
