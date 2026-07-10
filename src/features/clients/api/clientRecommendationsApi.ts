import { apiRequest } from '../../../shared/api/apiClient'
import type {
  RecommendationProduct,
} from '../recommendationsTypes'

export async function getMostPurchasedProductsByClientId(
  clientNetId: string,
  byRegion: boolean,
  options?: { clientAgreementNetId?: string; signal?: AbortSignal },
): Promise<RecommendationProduct[]> {
  const result = await apiRequest<unknown>('/recommendations/get', {
    query: {
      clientNetId,
      byRegion,
      // With an agreement the server hydrates availability (AvailableQty* + rows),
      // so the sale wizard shows real quantities on recommendations.
      ...(options?.clientAgreementNetId ? { clientAgreementNetId: options.clientAgreementNetId } : {}),
    },
    ...(options?.signal ? { signal: options.signal } : {}),
  })

  return normalizeRecommendationProducts(result)
}

export async function getProductCoPurchaseRecommendations(
  productNetId: string,
  clientNetId: string,
  byRegion: boolean,
  signal?: AbortSignal,
): Promise<RecommendationProduct[]> {
  const result = await apiRequest<unknown>('/recommendations/get/product', {
    query: {
      clientNetId,
      productNetId,
      byRegion,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeRecommendationProducts(result)
}

export async function getProductById(
  netId: string,
  signal?: AbortSignal,
): Promise<RecommendationProduct | null> {
  const result = await apiRequest<unknown>('/products/get', {
    query: {
      netId,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeRecommendationProduct(result)
}

function normalizeRecommendationProducts(result: unknown): RecommendationProduct[] {
  if (Array.isArray(result)) {
    return result as RecommendationProduct[]
  }

  if (result && typeof result === 'object') {
    const items = (result as { Items?: unknown }).Items

    if (Array.isArray(items)) {
      return items as RecommendationProduct[]
    }
  }

  return []
}

function normalizeRecommendationProduct(result: unknown): RecommendationProduct | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as RecommendationProduct
}
