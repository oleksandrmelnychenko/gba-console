import type { RecommendationProduct } from '../../recommendationsTypes'

export function getRecommendationProductKey(product: RecommendationProduct, index: number): string {
  return product.NetUid || (product.Id != null ? String(product.Id) : String(index))
}

