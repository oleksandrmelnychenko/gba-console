import type { CalculatedProductPrice, ProductFileUploadPriceConfiguration } from './types'

export type ProductPriceBreakdown = {
  basePriceEUR?: number
  discountPriceEUR?: number
  discountRate?: number
  hasBasePrice: boolean
  hasDiscount: boolean
  pricingName: string
  retailPriceEUR?: number
  retailPriceLocal?: number
}

export type ProductUploadPriceRowLike = {
  columnNumber?: number | null
  pricingId?: string | null
}

export function getProductPriceBreakdown(price: CalculatedProductPrice): ProductPriceBreakdown {
  const basePriceEUR = readFiniteNumber(price.PriceEUR)
  const discountPriceEUR = readFiniteNumber(price.DiscountPriceEUR)
  const discountRate = readFiniteNumber(price.DiscountRate)

  return {
    basePriceEUR,
    discountPriceEUR,
    discountRate,
    hasBasePrice: basePriceEUR !== undefined,
    hasDiscount: discountPriceEUR !== undefined || discountRate !== undefined,
    pricingName: price.Pricing?.Name?.trim() || '',
    retailPriceEUR: readFiniteNumber(price.RetailPriceEUR),
    retailPriceLocal: readFiniteNumber(price.RetailPriceLocal),
  }
}

export function getDuplicateProductUploadPricingIds(rows: ProductUploadPriceRowLike[]): string[] {
  const seenIds = new Set<string>()
  const duplicateIds = new Set<string>()

  rows.forEach((row) => {
    const pricingId = normalizePricingId(row.pricingId)

    if (!pricingId) {
      return
    }

    if (seenIds.has(pricingId)) {
      duplicateIds.add(pricingId)
      return
    }

    seenIds.add(pricingId)
  })

  return Array.from(duplicateIds)
}

export function hasDuplicateProductUploadPricings(rows: ProductUploadPriceRowLike[]): boolean {
  return getDuplicateProductUploadPricingIds(rows).length > 0
}

export function isDuplicateProductUploadPricingId(
  rows: ProductUploadPriceRowLike[],
  pricingId: string | null | undefined,
): boolean {
  const normalizedPricingId = normalizePricingId(pricingId)

  return Boolean(normalizedPricingId && getDuplicateProductUploadPricingIds(rows).includes(normalizedPricingId))
}

export function buildProductUploadPriceConfigurations(
  rows: ProductUploadPriceRowLike[],
): ProductFileUploadPriceConfiguration[] {
  return rows.reduce<ProductFileUploadPriceConfiguration[]>((items, row) => {
    const pricingId = normalizePricingId(row.pricingId)
    const numericPricingId = pricingId ? Number(pricingId) : Number.NaN
    const columnNumber = readFiniteNumber(row.columnNumber ?? undefined)

    if (Number.isFinite(numericPricingId) && columnNumber !== undefined && columnNumber > 0) {
      items.push({
        ColumnNumber: columnNumber,
        PricingId: numericPricingId,
      })
    }

    return items
  }, [])
}

function readFiniteNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizePricingId(value: string | null | undefined): string {
  return value?.trim() || ''
}
