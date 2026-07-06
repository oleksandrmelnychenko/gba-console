import type { WizardCalculatedProductPricing } from './newSaleWizardApi'
import type { WizardSaleProduct } from './wizardSaleProduct'

export type WizardProductPriceRow = {
  currency: string
  key: 'base-eur' | 'discount-eur' | 'retail-eur' | 'retail-local'
  label: string
  tone?: 'strong'
  value: number
}

export function buildWizardProductPriceRows({
  localCurrency = 'UAH',
  pricing,
  product,
}: {
  localCurrency?: string
  pricing?: WizardCalculatedProductPricing | null
  product: WizardSaleProduct
}): WizardProductPriceRow[] {
  const baseLabel = getNonEmptyString(pricing?.Pricing?.Name) ?? 'База'

  return compactPriceRows([
    {
      currency: 'EUR',
      key: 'base-eur',
      label: baseLabel,
      value: firstFiniteNumber(pricing?.PriceEUR, product.CurrentPrice),
    },
    {
      currency: 'EUR',
      key: 'discount-eur',
      label: 'Зі знижкою',
      tone: 'strong',
      value: firstFiniteNumber(pricing?.DiscountPriceEUR, pricing?.PriceEUR, product.CurrentPrice),
    },
    {
      currency: 'EUR',
      key: 'retail-eur',
      label: 'Роздріб',
      value: firstFiniteNumber(pricing?.RetailPriceEUR),
    },
    {
      currency: localCurrency,
      key: 'retail-local',
      label: 'Роздріб',
      value: firstFiniteNumber(pricing?.RetailPriceLocal),
    },
  ])
}

function compactPriceRows(rows: Array<Omit<WizardProductPriceRow, 'value'> & { value: number | null }>): WizardProductPriceRow[] {
  return rows.flatMap((row) => (row.value == null ? [] : [{ ...row, value: row.value }]))
}

function firstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : Number.NaN

    if (Number.isFinite(numeric)) {
      return numeric
    }
  }

  return null
}

function getNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
