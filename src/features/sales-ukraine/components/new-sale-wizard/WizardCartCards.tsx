import { memo } from 'react'
import { Button, Group, Text } from '@mantine/core'
import { Ellipsis, ShoppingCart, Trash2 } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableChip } from '../../../../shared/ui/TableChip'
import { TableRowAction } from '../../../../shared/ui/table-row-action'
import { getProductMainOriginalNumber } from '../../../products/utils'
import type { SalesUkraineOrderItem } from '../../types'
import { WizardProductPhoto } from './WizardProductPhoto'
import type { WizardCartPricing } from './useWizardCartPricing'
import { getOrderItemLocalPrice, getOrderItemLocalTotal, getWizardProductNumber, type WizardSaleProduct } from './wizardSaleProduct'

const money = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

type WizardCartCardsProps = {
  agreementNetId?: string | null
  prices?: ReadonlyMap<string, WizardCartPricing>
  onRetryPricing?: () => void
  items: SalesUkraineOrderItem[]
  busy: boolean
  localCurrencyCode: string
  useEurToUah: boolean
  onRowClick?: (item: SalesUkraineOrderItem) => void
  onRemove?: (item: SalesUkraineOrderItem) => void
  onCrossSell?: (item: SalesUkraineOrderItem) => void
}

export const WizardCartCards = memo(function WizardCartCards({ items, prices, ...cardProps }: WizardCartCardsProps) {
  const { t } = useI18n()
  if (items.length === 0) return <div className="wizard-cart-cards__empty"><ShoppingCart size={28} /><Text>{t('Кошик порожній')}</Text></div>

  return (
    <div className="wizard-cart-cards app-table-chips" role="list" aria-label={t('Товари в кошику')} aria-busy={cardProps.busy} onKeyDown={(event) => {
      if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-cart-card-action]')) return
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-cart-card-action]')]
      const index = buttons.indexOf(event.target as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
      buttons[next]?.focus()
    }}>
      {items.map((item, index) => <WizardCartCard key={item.NetUid || item.Id || `${item.Product?.VendorCode || item.Product?.Articul || '—'}-${index}`} item={item} index={index} pricingState={item.Product?.NetUid ? prices?.get(item.Product.NetUid) : undefined} {...cardProps} />)}
    </div>
  )
})

const WizardCartCard = memo(function WizardCartCard({ item, index, agreementNetId, pricingState, busy, localCurrencyCode, useEurToUah, onRowClick, onRemove, onCrossSell, onRetryPricing }: Omit<WizardCartCardsProps, 'items' | 'prices'> & { item: SalesUkraineOrderItem; index: number; pricingState?: WizardCartPricing }) {
  const { t } = useI18n()
  const product = item.Product as WizardSaleProduct | undefined
  const code = product?.VendorCode || product?.Articul || '—'
  const name = product?.NameUA || product?.Name || t('Без назви')
  const original = product ? getProductMainOriginalNumber(product) : null
  const pricing = pricingState?.pricing
  const formatPrice = (value: unknown) => {
    const number = getWizardProductNumber(value)
    return number == null ? '—' : money.format(number)
  }
  return (
  <article className="wizard-cart-card" role="listitem">
    <span className="wizard-cart-card__index">{String(index + 1).padStart(2, '0')}</span>
    {product ? <WizardProductPhoto className="wizard-cart-card__photo" product={product} /> : <div className="wizard-cart-card__photo"><ShoppingCart size={24} /></div>}
    <div className="wizard-cart-card__identity">
      <Group gap={8}><TableChip tone="product" value={code} />{onCrossSell && <TableRowAction action="recommend" disabled={busy} label={t('Кросс-продажі до товару')} onClick={() => onCrossSell(item)} />}</Group>
      <h3>{name}</h3>
      <div className="wizard-cart-card__facts">
        {original && <span>OEM <TableChip tone="warning" value={original} /></span>}
        {product?.Size && <span>{t('Розмір')} <TableChip tone="warning" value={product.Size} /></span>}
      </div>
      {item.Comment && <Text size="xs" c="dimmed">{item.Comment}</Text>}
      <Group gap={10} className="wizard-cart-card__actions">
        <span className="wizard-cart-card__quantity">{t('К-сть')} <TableChip value={`${qty.format(getWizardProductNumber(item.Qty) ?? 0)} ${product?.MeasureUnit?.Name || t('шт')}`} /></span>
        {onRowClick && <Button data-cart-card-action disabled={busy} variant="default" size="compact-xs" leftSection={<Ellipsis size={14} />} aria-label={`${t('Дії з товаром')} · ${code}`} onClick={() => onRowClick(item)}>{t('Дії')}</Button>}
        {onRemove && <Button disabled={busy} color="red" variant="subtle" size="compact-xs" leftSection={<Trash2 size={14} />} onClick={() => onRemove(item)}>{t('Видалити')}</Button>}
      </Group>
    </div>
    <div className="wizard-cart-card__prices">
      <table aria-label={`${t('Ціни')} · ${code}`}>
        <thead><tr><th /><th><TableChip tone="source" value="EUR" /></th><th><TableChip tone="source" value={localCurrencyCode} /></th></tr></thead>
        <tbody>
          <tr><th scope="row">{t('Ціна')}</th><td>{money.format(getWizardProductNumber(product?.CurrentPrice) ?? 0)}</td><td>{money.format(getOrderItemLocalPrice(item, useEurToUah))}</td></tr>
          {pricing ? <>
            <tr><th scope="row">{pricing.Pricing?.Name?.trim() || t('База')}</th><td>{formatPrice(pricing.PriceEUR)}</td><td>—</td></tr>
            <tr><th scope="row">{t('Зі знижкою')}</th><td>{formatPrice(pricing.DiscountPriceEUR)}</td><td>—</td></tr>
            <tr><th scope="row">{t('Роздріб')}</th><td>{formatPrice(pricing.RetailPriceEUR)}</td><td>{formatPrice(pricing.RetailPriceLocal)}</td></tr>
          </> : <tr><td colSpan={3}>
            <Text size="xs" c="dimmed" role="status">
              {!agreementNetId || !product?.NetUid || pricingState?.status === 'ready' ? t('Типи цін недоступні')
                : pricingState?.status === 'error' ? t('Не вдалося завантажити типи цін') : t('Завантаження типів цін…')}
            </Text>
            {pricingState?.status === 'error' && <Button size="compact-xs" variant="subtle" onClick={onRetryPricing}>{t('Повторити')}</Button>}
          </td></tr>}
          <tr className="wizard-cart-card__total"><th scope="row">{t('Сума')}</th><td>{money.format(getWizardProductNumber(item.TotalAmount) ?? 0)}</td><td>{money.format(getOrderItemLocalTotal(item, useEurToUah))}</td></tr>
        </tbody>
      </table>
    </div>
  </article>
  )
})
