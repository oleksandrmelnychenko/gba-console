import { memo, useMemo } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableChip } from '../../../../shared/ui/TableChip'
import type { SalesUkraineOrderItem } from '../../types'
import { WizardCartCards } from './WizardCartCards'
import { getWizardCartTotals } from './wizardCartTotals'
import './wizard-cart-sheet.css'
import './wizard-review-order-summary.css'

const moneyFormatter = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quantityFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export const WizardReviewOrderSummary = memo(function WizardReviewOrderSummary({ items, localCurrencyCode, useEurToUah }: {
  items: SalesUkraineOrderItem[]
  localCurrencyCode: string
  useEurToUah: boolean
}) {
  const { t } = useI18n()

  return (
    <section className="wizard-review-order-summary app-table-chips" aria-label={t('Ваше замовлення')}>
      <header className="wizard-review-order-summary__header">
        <ShoppingCart size={20} aria-hidden="true" />
        <h2>{t('Ваше замовлення')}</h2>
        <TableChip value={items.length} />
      </header>
      <WizardCartCards
        items={items}
        busy={false}
        localCurrencyCode={localCurrencyCode}
        useEurToUah={useEurToUah}
      />
    </section>
  )
})

export const WizardReviewOrderTotals = memo(function WizardReviewOrderTotals({ items, localCurrencyCode, useEurToUah }: {
  items: SalesUkraineOrderItem[]
  localCurrencyCode: string
  useEurToUah: boolean
}) {
  const { t } = useI18n()
  const totals = useMemo(() => getWizardCartTotals(items, useEurToUah), [items, useEurToUah])

  return (
    <footer className="wizard-review-order-summary__totals app-table-chips" aria-label={t('Підсумок замовлення')}>
      <div className="wizard-review-order-summary__quantity">
        <span>{t('Кількість')}</span>
        <strong>{quantityFormatter.format(totals.quantity)}</strong>
      </div>
      <div className="wizard-review-order-summary__amounts">
        <span>{t('Разом')}</span>
        <div>
          <strong>{moneyFormatter.format(totals.eur)}</strong>
          <TableChip tone="source" value="EUR" />
        </div>
        <div>
          <strong>{moneyFormatter.format(totals.local)}</strong>
          <TableChip tone="source" value={localCurrencyCode} />
        </div>
      </div>
    </footer>
  )
})
