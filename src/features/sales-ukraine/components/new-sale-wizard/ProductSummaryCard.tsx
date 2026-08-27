import { Button, Image } from '@mantine/core'
import { Eye, Image as ImageIcon } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { getProductMainImage, getProductShopImageUrl, getRelatedProductRowColor } from '../../../products/utils'
import type { WizardCalculatedProductPricing } from './newSaleWizardApi'
import { buildWizardProductPriceRows } from './wizardProductPricing'
import { getWizardProductNumber, type WizardSaleProduct } from './wizardSaleProduct'
import './product-summary-card.css'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const priceFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function ProductSummaryCard({
  currentPriceEur,
  detailsExpanded,
  displayQty = 0,
  localCurrencyCode = 'UAH',
  onOpenDetails,
  onOpenImage,
  pricing,
  product,
}: {
  currentPriceEur?: number | null
  detailsExpanded?: boolean
  displayQty?: number
  localCurrencyCode?: string
  onOpenDetails?: () => void
  onOpenImage?: () => void
  pricing: WizardCalculatedProductPricing | null
  product: WizardSaleProduct
}) {
  const { t } = useI18n()
  const shopImageUrl = getProductShopImageUrl(product)
  // Search results can omit ProductImages, so retain the shop-image fallback.
  const imageUrl = getProductMainImage(product)?.ImageUrl || shopImageUrl
  const code = product.VendorCode || product.Articul || ''
  const name = product.NameUA || product.Name || t('Без назви')
  const unit = product.MeasureUnit?.Name || t('шт')
  const currentPrice = currentPriceEur ?? getWizardProductNumber(product.CurrentPrice)
  const localPrice = getWizardProductNumber(product.CurrentPriceEurToUah) ?? getWizardProductNumber(product.CurrentLocalPrice)
  const priceRows = buildWizardProductPriceRows({ localCurrency: localCurrencyCode, pricing, product })
  const facts = [
    { label: t('Оригінальний номер'), value: product.MainOriginalNumber },
    { label: 'TOP', value: product.Top },
    { label: t('Розмір'), value: product.Size },
    { label: t('Одиниця'), value: unit },
  ].filter((item) => item.value)
  const photo = imageUrl ? (
    <Image alt={name} fallbackSrc={shopImageUrl || undefined} fit="contain" h="100%" src={imageUrl} w="100%" />
  ) : (
    <ImageIcon aria-label={t('Фото відсутнє')} size={24} strokeWidth={1.5} />
  )

  return (
    <section aria-label={t('Коротка інформація про товар')} className="new-sale-product-summary">
      <header className="app-detail-hero new-sale-product-summary__hero">
        <div className="new-sale-product-summary__identity">
          {imageUrl && onOpenImage ? (
            <button
              aria-haspopup="dialog"
              aria-label={`${t('Збільшити фото')} · ${name}`}
              className="new-sale-product-summary__photo is-interactive"
              title={t('Збільшити фото')}
              type="button"
              onClick={onOpenImage}
              onKeyDown={(event) => {
                // Handle activation once, without the wizard's Enter-to-add shortcut.
                if ((event.key === 'Enter' || event.key === ' ') && !event.ctrlKey && !event.altKey && !event.metaKey) {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!event.repeat) onOpenImage()
                }
              }}
            >
              {photo}
            </button>
          ) : (
            <div className="new-sale-product-summary__photo">{photo}</div>
          )}
          <div className="new-sale-product-summary__heading">
            <span className="new-sale-product-summary__eyebrow">{t('Товар')}</span>
            <strong className={`new-sale-product-summary__code${code ? '' : ' is-missing'}`}>{code || t('Код відсутній')}</strong>
            <h3 className="new-sale-product-summary__name" style={{ color: getRelatedProductRowColor(product) }}>{name}</h3>
            <dl className="new-sale-product-summary__facts">
              {facts.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="new-sale-product-summary__side">
          <div className="new-sale-product-summary__metrics">
            <Metric label={t('Доступно')} meta={unit} value={qtyFormatter.format(displayQty)} />
            {currentPrice != null && <Metric label={t('Ціна в EUR')} meta="EUR" money value={priceFormatter.format(currentPrice)} />}
            {localPrice != null && <Metric label={t('Ціна в') + ' ' + localCurrencyCode} meta={localCurrencyCode} money value={priceFormatter.format(localPrice)} />}
            {priceRows.map((row) => (
              <Metric key={row.key} label={t(row.label)} meta={row.currency} money value={priceFormatter.format(row.value)} />
            ))}
          </div>
          {onOpenDetails && (
            <Button
              aria-expanded={detailsExpanded}
              aria-haspopup="dialog"
              className="new-sale-product-summary__details"
              color={CREATE_ACTION_COLOR}
              leftSection={<Eye aria-hidden="true" size={16} strokeWidth={1.8} />}
              size="sm"
              variant="filled"
              onClick={onOpenDetails}
            >
              {t('Деталі')}
            </Button>
          )}
        </div>
      </header>
    </section>
  )
}

function Metric({ label, meta, money, value }: { label: string; meta: string; money?: boolean; value: string }) {
  return (
    <div className="new-sale-product-summary__metric">
      <span title={label}>{label}</span>
      <strong className={money ? 'app-money' : undefined}>{value}</strong>
      <small className={money ? 'app-money-meta' : undefined}>{meta}</small>
    </div>
  )
}
