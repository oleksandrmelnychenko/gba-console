import { ActionIcon, ScrollArea, Tooltip } from '@mantine/core'
import { IconPackage, IconTrash } from '@tabler/icons-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { roundMoney } from '../../saleMoney'
import type { SalesUkraineOrderItem } from '../../types'
import {
  getOrderItemDiscount,
  getOrderItemLocalPrice,
  getOrderItemLocalTotal,
  getWizardProductNumber,
  type WizardSaleProduct,
} from './wizardSaleProduct'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const priceFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

function displayValue(value: unknown): string {
  const text = value == null ? '' : String(value).trim()

  return text || '-'
}

export function WizardShoppingCartGrid({
  busy = false,
  items,
  localCurrencyCode,
  useEurToUah,
  onRemove,
  onRowClick,
}: {
  busy?: boolean
  items: SalesUkraineOrderItem[]
  localCurrencyCode: string
  useEurToUah: boolean
  onRemove?: (item: SalesUkraineOrderItem) => void
  onRowClick?: (item: SalesUkraineOrderItem) => void
}) {
  const { t } = useI18n()
  const totalQty = items.reduce((sum, item) => sum + (getWizardProductNumber(item.Qty) ?? 0), 0)
  const totalAmount = roundMoney(items.reduce((sum, item) => sum + (getWizardProductNumber(item.TotalAmount) ?? 0), 0))
  const totalAmountLocal = roundMoney(items.reduce((sum, item) => sum + getOrderItemLocalTotal(item, useEurToUah), 0))
  const gridClassName = `new-sale-cart__grid${onRemove ? ' has-actions' : ''}`

  return (
    <div className="new-sale-cart">
      <ScrollArea.Autosize mah={280} type="auto">
        <div className={gridClassName} role="table" aria-label={t('Кошик')}>
          <div className="new-sale-cart__head" role="row">
            <span>#</span>
            <span>{t('Товар')}</span>
            <span>{t('Коментар')}</span>
            <span>{t('Ориг. номер')}</span>
            <span>{t('Митний код')}</span>
            <span>{t('Додав')}</span>
            <span className="is-right">{t('К-сть')}</span>
            <span className="is-right">{t('Ціна')}</span>
            <span className="is-right">{t('Сума')}</span>
            <span className="is-right">{t('Знижка / ручна')}</span>
            {onRemove && <span />}
          </div>
          <div className="new-sale-cart__body" role="rowgroup">
            {items.length === 0 ? (
              <div className="new-sale-cart__empty">{t('Кошик порожній')}</div>
            ) : (
              items.map((item, index) => {
                const product = item.Product as WizardSaleProduct | undefined
                const code = displayValue(item.Product?.VendorCode || item.Product?.Articul)
                const name = displayValue(item.Product?.NameUA || item.Product?.Name)
                const comment = displayValue(item.Comment)
                const originalNumber = displayValue(item.Product?.MainOriginalNumber)
                const specificationCode = displayValue(item.AssignedSpecification?.SpecificationCode)
                const addedBy = displayValue(item.User?.LastName)
                const qty = qtyFormatter.format(getWizardProductNumber(item.Qty) ?? 0)
                const eurPrice = priceFormatter.format(getWizardProductNumber(product?.CurrentPrice) ?? 0)
                const localPrice = priceFormatter.format(getOrderItemLocalPrice(item, useEurToUah))
                const totalEur = priceFormatter.format(getWizardProductNumber(item.TotalAmount) ?? 0)
                const totalLocal = priceFormatter.format(getOrderItemLocalTotal(item, useEurToUah))
                const discount = priceFormatter.format(getOrderItemDiscount(item))
                const manualDiscount = priceFormatter.format(getWizardProductNumber(item.OneTimeDiscount) ?? 0)

                return (
                  <div
                    key={String(item.NetUid || item.Id || index)}
                    className={`new-sale-cart__row${onRowClick ? ' is-clickable' : ''}`}
                    role={onRowClick ? 'button' : 'row'}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={() => onRowClick?.(item)}
                    onKeyDown={(event) => {
                      if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) {
                        return
                      }

                      event.preventDefault()
                      onRowClick(item)
                    }}
                  >
                    <div className="new-sale-cart__index">{index + 1}</div>
                    <div className="new-sale-cart__product">
                      <span className="new-sale-cart__product-icon" aria-hidden="true">
                        <IconPackage size={14} />
                      </span>
                      <div className="new-sale-cart__product-copy">
                        <span className="new-sale-cart__product-code" title={code}>
                          {code}
                        </span>
                        <span className="new-sale-cart__product-name" title={name}>
                          {name}
                        </span>
                      </div>
                    </div>
                    <div className="new-sale-cart__text-cell" title={comment}>
                      {comment}
                    </div>
                    <div className="new-sale-cart__text-cell" title={originalNumber}>
                      {originalNumber}
                    </div>
                    <div className="new-sale-cart__text-cell" title={specificationCode}>
                      {specificationCode}
                    </div>
                    <div className="new-sale-cart__text-cell" title={addedBy}>
                      {addedBy}
                    </div>
                    <div className="new-sale-cart__metric is-qty">
                      <strong>{qty}</strong>
                    </div>
                    <div className="new-sale-cart__money-pair">
                      <span>
                        <strong>{eurPrice}</strong>
                        <em>EUR</em>
                      </span>
                      <span>
                        <strong>{localPrice}</strong>
                        <em>{localCurrencyCode}</em>
                      </span>
                    </div>
                    <div className="new-sale-cart__money-pair is-total">
                      <span>
                        <strong>{totalEur}</strong>
                        <em>EUR</em>
                      </span>
                      <span>
                        <strong>{totalLocal}</strong>
                        <em>{localCurrencyCode}</em>
                      </span>
                    </div>
                    <div className="new-sale-cart__money-pair is-discount">
                      <span>
                        <strong>{discount}</strong>
                      </span>
                      <span>
                        <strong>{manualDiscount}</strong>
                      </span>
                    </div>
                    {onRemove && (
                      <div className="new-sale-cart__action">
                        <Tooltip label={t('Видалити')}>
                          <ActionIcon
                            aria-label={t('Видалити')}
                            color="red"
                            disabled={busy}
                            size="sm"
                            variant="subtle"
                            onClick={(event) => {
                              event.stopPropagation()
                              onRemove(item)
                            }}
                          >
                            <IconTrash size={15} />
                          </ActionIcon>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </ScrollArea.Autosize>

      {items.length > 0 && (
        <div className="new-sale-cart__totals">
          <div className="new-sale-cart__total">
            <span>{t('К-сть')}</span>
            <strong>{qtyFormatter.format(totalQty)}</strong>
          </div>
          <div className="new-sale-cart__total">
            <span>EUR</span>
            <strong>{priceFormatter.format(totalAmount)}</strong>
          </div>
          <div className="new-sale-cart__total is-strong">
            <span>{localCurrencyCode}</span>
            <strong>{priceFormatter.format(totalAmountLocal)}</strong>
          </div>
        </div>
      )}
    </div>
  )
}
