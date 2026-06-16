import { apiRequest } from '../../../shared/api/apiClient'
import type { PriceRecommendation } from '../pricingTypes'

export async function getPriceRecommendation(
  productNetId: string,
  clientAgreementNetId: string,
  culture = 'uk',
  withVat = true,
  signal?: AbortSignal,
): Promise<PriceRecommendation> {
  return apiRequest<PriceRecommendation>('/pricing/recommend', {
    query: {
      productNetId,
      clientAgreementNetId,
      culture,
      withVat,
    },
    ...(signal ? { signal } : {}),
  })
}
