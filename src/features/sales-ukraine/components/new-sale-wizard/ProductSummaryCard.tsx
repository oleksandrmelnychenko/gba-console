import { TableChip, type TableChipTone } from '../../../../shared/ui/TableChip'
import { Button } from '@mantine/core'
import { useMemo } from 'react'
import { Eye } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { getProductMainOriginalNumber, isCriticalProductTop } from '../../../products/utils'
import type { WizardCalculatedProductPricing } from './newSaleWizardApi'
import { buildWizardProductPriceMatrix } from './wizardProductPricing'
import type { WizardSaleProduct } from './wizardSaleProduct'
import { WizardProductPhoto } from './WizardProductPhoto'
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
  variant = 'compact',
}: {
  currentPriceEur?: number | null
  detailsExpanded?: boolean
  displayQty?: number
  localCurrencyCode?: string
  onOpenDetails?: () => void
  onOpenImage?: () => void
  pricing: WizardCalculatedProductPricing | null
  product: WizardSaleProduct
  variant?: 'compact' | 'detail'
}) {
  const { t } = useI18n()
  const code = product.VendorCode || product.Articul || ''
  const name = product.NameUA || product.Name || t('Без назви')
  const top = product.Top?.trim()
  const unit = product.MeasureUnit?.Name || t('шт')
  const matrixRows = useMemo(() => buildWizardProductPriceMatrix({ currentPriceEur, localCurrency: localCurrencyCode, pricing, product }),
    [currentPriceEur, localCurrencyCode, pricing, product])
  const facts: { label: string; value: string | null | undefined; tone?: TableChipTone }[] = [
    { label: t('Оригінальний номер'), value: getProductMainOriginalNumber(product), tone: 'warning' as const },
    { label: t('Розмір'), value: product.Size, tone: 'warning' as const },
  ].filter((item) => item.value && !['-', '—'].includes(String(item.value).trim()))

  return (
    <section aria-label={t('Коротка інформація про товар')} className={`new-sale-product-summary new-sale-product-summary--${variant}`}>
      <header className="new-sale-product-summary__hero">
        <div className="new-sale-product-summary__identity">
          <div className="new-sale-product-summary__heading">
            <div className="new-sale-product-summary__title-row">
              <TableChip tone="product" value={code || t('Код відсутній')} />
              <h3 className="new-sale-product-summary__name">{name}</h3>
              {top && !['-', '—'].includes(top) && (
                <span className="new-sale-product-summary__top">
                  <span>Top</span>
                  {isCriticalProductTop(top) ? <TableChip tone="danger" value={top} /> : <strong className="app-money">{top}</strong>}
                </span>
              )}
            </div>
            {facts.length > 0 && <dl className="new-sale-product-summary__metadata">
              {facts.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.tone ? <TableChip tone={item.tone} value={item.value} /> : <span className="app-money">{item.value}</span>}</dd>
                </div>
              ))}
            </dl>}
          </div>
        </div>
        <div className="new-sale-product-summary__actions">
          <div className="new-sale-product-summary__stock">
            <span>{t('Доступно')}</span>
            <strong>{qtyFormatter.format(displayQty)}</strong>
            <TableChip tone="neutral" value={unit} />
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
      <div className="new-sale-product-summary__body">
        <WizardProductPhoto className="new-sale-product-summary__photo" hoverPreview={variant !== 'detail'} product={product} onOpen={onOpenImage} />
      <div className="new-sale-product-summary__pricing">
        <table aria-label={t('Ціни товару')} className="app-static-table new-sale-product-summary__price-table">
          <thead>
            <tr>
              <th scope="col">{t('Тип ціни')}</th>
              <th className="app-table-cell-number" scope="col"><TableChip tone="source" value="EUR" /></th>
              <th className="app-table-cell-number" scope="col"><TableChip tone="source" value={localCurrencyCode} /></th>
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{t(row.label)}</th>
                <td className="app-table-cell-number">{row.eur == null ? '—' : priceFormatter.format(row.eur)}</td>
                <td className="app-table-cell-number">{row.local == null ? null : priceFormatter.format(row.local)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </section>
  )
}
