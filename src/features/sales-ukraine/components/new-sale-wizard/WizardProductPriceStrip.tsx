import { Box } from '@mantine/core'
import type { WizardCalculatedProductPricing } from './newSaleWizardApi'
import { buildWizardProductPriceRows } from './wizardProductPricing'
import type { WizardSaleProduct } from './wizardSaleProduct'

const priceFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function WizardProductPriceStrip({
  dense = false,
  localCurrency = 'UAH',
  pricing,
  product,
}: {
  dense?: boolean
  localCurrency?: string
  pricing?: WizardCalculatedProductPricing | null
  product: WizardSaleProduct
}) {
  const rows = buildWizardProductPriceRows({ localCurrency, pricing, product })

  if (!rows.length) {
    return null
  }

  return (
    <Box className={`new-sale-product-price-strip ${dense ? 'is-dense' : ''}`}>
      {rows.map((row) => (
        <Box key={row.key} className={`new-sale-product-price-strip__item ${row.tone === 'strong' ? 'is-strong' : ''}`}>
          <span className="new-sale-product-price-strip__label">{row.label}</span>
          <strong className="new-sale-product-price-strip__value">{priceFormatter.format(row.value)}</strong>
          <small className="new-sale-product-price-strip__currency">{row.currency}</small>
        </Box>
      ))}
    </Box>
  )
}
