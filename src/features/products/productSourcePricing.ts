import type { ProductSourcePrice, ProductSourcePriceSet } from './types'

export type ProductSourceComparisonRow = {
  amg?: ProductSourcePrice
  differenceEur?: number
  fenix?: ProductSourcePrice
  pricingName: string
}

export function buildProductSourceComparisonRows(
  amg?: ProductSourcePriceSet | null,
  fenix?: ProductSourcePriceSet | null,
): ProductSourceComparisonRow[] {
  const rowsByName = new Map<string, ProductSourceComparisonRow>()

  appendSourcePrices(rowsByName, amg?.Prices, 'amg')
  appendSourcePrices(rowsByName, fenix?.Prices, 'fenix')

  return [...rowsByName.values()]
    .map((row) => ({
      ...row,
      differenceEur: calculateDifference(row.amg?.PriceEur, row.fenix?.PriceEur),
    }))
    .sort((left, right) => left.pricingName.localeCompare(right.pricingName, 'uk', { sensitivity: 'base' }))
}

function appendSourcePrices(
  rowsByName: Map<string, ProductSourceComparisonRow>,
  prices: ProductSourcePrice[] | undefined,
  source: 'amg' | 'fenix',
) {
  for (const price of prices || []) {
    const pricingName = price.PricingName?.trim()

    if (!pricingName || isPolishPricingName(pricingName)) {
      continue
    }

    const key = pricingName.toLocaleLowerCase('uk')
    const row = rowsByName.get(key) || { pricingName }

    row[source] = price
    rowsByName.set(key, row)
  }
}

export function isPolishPricingName(pricingName: string | null | undefined): boolean {
  return /^[PР]L/iu.test(pricingName?.trim() || '')
}

function calculateDifference(amgValue?: number | null, fenixValue?: number | null): number | undefined {
  if (!isFiniteNumber(amgValue) || !isFiniteNumber(fenixValue)) {
    return undefined
  }

  return Number((fenixValue - amgValue).toFixed(8))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
