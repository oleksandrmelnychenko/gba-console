import type { ProductCapitalizationSearchProduct } from './types'

export function resolveProductCapitalizationSelection(
  selectedProduct: ProductCapitalizationSearchProduct | null,
  searchedProducts: ProductCapitalizationSearchProduct[],
  query: string,
): ProductCapitalizationSearchProduct | null {
  if (selectedProduct) {
    return selectedProduct
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()

  if (!normalizedQuery) {
    return null
  }

  const exactMatch = searchedProducts.find((product) => product.VendorCode?.trim().toLocaleLowerCase() === normalizedQuery)

  if (exactMatch) {
    return exactMatch
  }

  return searchedProducts.length === 1 ? searchedProducts[0] : null
}
