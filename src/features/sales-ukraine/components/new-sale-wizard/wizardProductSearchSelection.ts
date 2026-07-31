import type { WizardSaleProduct } from './wizardSaleProduct'

export type ExactWizardProductSearchMatch = {
  index: number
  product: WizardSaleProduct
}

function normalizeProductCode(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function isExactProductCodeMatch(query: string, product: WizardSaleProduct): boolean {
  return [product.VendorCode, product.Articul]
    .some((code) => normalizeProductCode(code) === query)
}

export function findUniqueExactWizardProductSearchMatch(
  query: string,
  products: WizardSaleProduct[],
): ExactWizardProductSearchMatch | null {
  const normalizedQuery = normalizeProductCode(query)

  if (!normalizedQuery) {
    return null
  }

  let match: ExactWizardProductSearchMatch | null = null

  for (const [index, product] of products.entries()) {
    if (!isExactProductCodeMatch(normalizedQuery, product)) {
      continue
    }

    if (match) {
      return null
    }

    match = { index, product }
  }

  return match
}
