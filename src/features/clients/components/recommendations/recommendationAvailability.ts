import type { RecommendationProduct } from '../../recommendationsTypes'

export function getRecommendationAvailableQty(
  product: RecommendationProduct,
  isVatSale: boolean,
): number {
  return isVatSale
    ? product.AvailableQtyUkVAT ?? 0
    : (product.AvailableQtyUk ?? 0) + (product.AvailableQtyUkReSale ?? 0)
}

export function hasRecommendationAvailabilityData(
  product: RecommendationProduct,
  isVatSale: boolean,
): boolean {
  return isVatSale
    ? typeof product.AvailableQtyUkVAT === 'number'
    : typeof product.AvailableQtyUk === 'number' || typeof product.AvailableQtyUkReSale === 'number'
}

export function canSelectRecommendationProduct(
  product: RecommendationProduct,
  isVatSale: boolean,
): boolean {
  return getRecommendationAvailableQty(product, isVatSale) > 0
}
