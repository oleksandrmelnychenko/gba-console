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
      // Legacy clients read this route as a bare product list; the metadata wrapper
      // ({Product, Score, Rank, Source}) is opt-in via includeMeta.
      includeMeta: true,
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
  options?: { clientAgreementNetId?: string; signal?: AbortSignal },
): Promise<RecommendationProduct[]> {
  const result = await apiRequest<unknown>('/recommendations/get/product', {
    query: {
      clientNetId,
      byRegion,
      includeMeta: true,
      // Empty productNetId must be omitted — the server binds it as Guid?.
      ...(productNetId ? { productNetId } : {}),
      ...(options?.clientAgreementNetId ? { clientAgreementNetId: options.clientAgreementNetId } : {}),
    },
    ...(options?.signal ? { signal: options.signal } : {}),
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
  const list = Array.isArray(result)
    ? result
    : (result && typeof result === 'object' && Array.isArray((result as { Items?: unknown }).Items)
      ? (result as { Items: unknown[] }).Items
      : [])

  return list.map((entry) => {
    const wrapper = entry as {
      Product?: RecommendationProduct
      Rank?: number
      Score?: number
      Source?: string
    }

    if (wrapper && typeof wrapper === 'object' && wrapper.Product && typeof wrapper.Product === 'object') {
      return {
        ...wrapper.Product,
        RecommendationRank: wrapper.Rank,
        RecommendationScore: wrapper.Score,
        RecommendationSource: wrapper.Source,
      }
    }

    return entry as RecommendationProduct
  })
}

function normalizeRecommendationProduct(result: unknown): RecommendationProduct | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as RecommendationProduct
}
