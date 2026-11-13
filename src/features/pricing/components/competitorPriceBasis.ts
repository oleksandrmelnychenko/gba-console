import type { CompetitorPriceSearchResult } from '../pricingTypes'

const CURRENCY_LABELS: Record<string, string> = { UAH: 'грн' }

const PRICE_BASIS_LABELS: Record<string, string> = {
  shelf: 'як на сторінці продавця',
}

const VAT_BASIS_LABELS: Record<string, string> = {
  unknown: 'чи входить ПДВ — невідомо',
  included: 'з ПДВ',
  excluded: 'без ПДВ',
}

export function competitorPriceBasisCaption(
  result: Pick<CompetitorPriceSearchResult, 'currency' | 'price_basis' | 'vat_basis'> | null | undefined,
): string {
  const currency = CURRENCY_LABELS[result?.currency ?? 'UAH'] ?? result?.currency ?? 'грн'
  const priceBasis = PRICE_BASIS_LABELS[result?.price_basis ?? 'shelf'] ?? `база ціни: ${result?.price_basis}`
  const vatBasis = VAT_BASIS_LABELS[result?.vat_basis ?? 'unknown'] ?? `ПДВ: ${result?.vat_basis}`
  return `Ціни — ${currency}, ${priceBasis}; ${vatBasis}; фасування не приведено до єдиного базису.`
}
