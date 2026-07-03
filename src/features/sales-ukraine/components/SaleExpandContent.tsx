import { Anchor, Box, Text } from '@mantine/core'
import { IconBox } from '@tabler/icons-react'
import { useState } from 'react'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
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
      >
        <div className="sale-expand-content-head">
          <span>{t('Товар')}</span>
          <span>{t('К-сть')}</span>
          <span>{localCurrencyCode || t('Сума')}</span>
          <span>{secondCode}</span>
          {isVatSale && <span>{t('ПДВ')}</span>}
          <span>{t('Знижки')}</span>
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
  const localAmountText = formatAmount(getNumber(orderItem.TotalAmountLocal))
  const secondAmountText = formatAmount(secondAmount)
  const overLordQty = getNumber(orderItem.OverLordQty)
  const qty = getNumber(orderItem.Qty)
  const qtyText = overLordQty ? `${displayValue(qty)} / ${overLordQty}` : displayValue(qty)
  const hasQtyOverflow = typeof overLordQty === 'number' && overLordQty !== 0 && qty !== overLordQty
  const comment = orderItem.Comment?.trim()
  const discountUpdater = getResponsible(orderItem.DiscountUpdatedBy)

  return (
    <div className={`sale-expand-content-item${hasQtyOverflow ? ' is-qty-warning' : ''}`}>
      <div className="sale-expand-product-cell">
        <span className="sale-expand-product-icon" aria-hidden="true">
          <IconBox size={14} stroke={1.7} />
        </span>
        <div className="sale-expand-product-copy">
          <div className="sale-expand-product-main">
            {openProductCard ? (
              <>
                <Anchor
                  className="sale-expand-product-code"
                  c={CREATE_ACTION_COLOR}
                  component="button"
                  title={displayValue(getOrderItemProductCode(orderItem))}
                  type="button"
                  onClick={openProductCard}
                >
                  {displayValue(getOrderItemProductCode(orderItem))}
                </Anchor>
                <Anchor
                  className="sale-expand-product-name"
                  c="dark.9"
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
              <span title={orderItem.Product.MainOriginalNumber}>{orderItem.Product.MainOriginalNumber}</span>
            )}
            {created && (
              <span>
                {t('Від')} {created}
              </span>
            )}
            {responsible && <span title={responsible}>{responsible}</span>}
            {specificationCode && (
              <span className="is-strong">
                {t('Митний код')}: {specificationCode}
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

      <div className="sale-expand-discount-cell">
        <div className="sale-expand-discount-line">
          <span>{t('База')}</span>
          <strong>{formatPercent(baseDiscount)}</strong>
        </div>
        <div className="sale-expand-discount-line">
          <span>{t('Разова')}</span>
          {!hasUniformDiscount && canEditDiscount ? (
            <Anchor
              className="sale-expand-discount-action"
              c="dark.8"
              component="button"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenItemDiscount()
              }}
            >
              {hasOneTimeDiscount ? formatPercent(oneTimeDiscount) : t('Знижка')}
            </Anchor>
          ) : (
            <strong>{hasOneTimeDiscount ? formatPercent(oneTimeDiscount) : ''}</strong>
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
    <div className={`sale-expand-value-cell${isQuantityAccent ? ' is-quantity-accent' : ''}${isWarning ? ' is-warning' : ''}`}>
      <strong>{value}</strong>
    </div>
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
