import { apiRequest } from '../../../shared/api/apiClient'
import { requireAiIsoDate } from '../../../shared/ai/aiHistoryLineage'
import type {
  RecommendationProduct,
  RecommendationSource,
  RecommendationSourceDetail,
} from '../recommendationsTypes'

export class RecommendationContractError extends Error {
  constructor(path: string, reason: string) {
    super(`Некоректна відповідь AI Recommendations (${path}): ${reason}`)
    this.name = 'RecommendationContractError'
  }
}

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
      : null)
  if (list === null) {
    throw new RecommendationContractError('recommendations', 'expected a bare array')
  }

  let expectedLineage: {
    source: string
    effective: string
    complete: boolean
  } | null = null

  return list.map((entry, index) => {
    const path = `recommendations[${index}]`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new RecommendationContractError(path, 'expected a metadata wrapper')
    }
    const wrapper = entry as Record<string, unknown>
    if (!wrapper.Product || typeof wrapper.Product !== 'object' || Array.isArray(wrapper.Product)) {
      throw new RecommendationContractError(`${path}.Product`, 'expected a hydrated product')
    }

    const source = requireAiIsoDate(
      wrapper.SourceHistoryStart,
      `${path}.SourceHistoryStart`,
      createRecommendationContractError,
    )
    const effective = requireAiIsoDate(
      wrapper.EffectiveStart,
      `${path}.EffectiveStart`,
      createRecommendationContractError,
    )
    if (source > effective) {
      throw new RecommendationContractError(path, 'history dates are inverted')
    }
    if (typeof wrapper.HistoryComplete !== 'boolean') {
      throw new RecommendationContractError(`${path}.HistoryComplete`, 'must be a boolean')
    }

    const lineage = { source, effective, complete: wrapper.HistoryComplete }
    if (
      expectedLineage !== null &&
      (lineage.source !== expectedLineage.source ||
        lineage.effective !== expectedLineage.effective ||
        lineage.complete !== expectedLineage.complete)
    ) {
      throw new RecommendationContractError(path, 'history proof differs between rows')
    }
    expectedLineage ??= lineage

    return {
      ...(wrapper.Product as RecommendationProduct),
      RecommendationRank: requireFiniteNumber(wrapper.Rank, `${path}.Rank`),
      RecommendationScore: requireFiniteNumber(wrapper.Score, `${path}.Score`),
      RecommendationSource: requireRecommendationSource(wrapper.Source, `${path}.Source`),
      RecommendationSourceDetail: requireRecommendationSourceDetail(
        wrapper.SourceDetail,
        `${path}.SourceDetail`,
      ),
      RecommendationSourceHistoryStart: source,
      RecommendationEffectiveStart: effective,
      RecommendationHistoryComplete: wrapper.HistoryComplete,
    }
  })
}

function createRecommendationContractError(path: string, reason: string) {
  return new RecommendationContractError(path, reason)
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RecommendationContractError(path, 'must be a finite number')
  }
  return value
}

function requireRecommendationSource(value: unknown, path: string): RecommendationSource {
  if (value !== 'discovery' && value !== 'repurchase') {
    throw new RecommendationContractError(path, 'contains an unsupported value')
  }
  return value
}

function requireRecommendationSourceDetail(
  value: unknown,
  path: string,
): RecommendationSourceDetail {
  if (
    value !== 'copurchase' &&
    value !== 'global_popular' &&
    value !== 'repurchase_history' &&
    value !== 'similar_clients'
  ) {
    throw new RecommendationContractError(path, 'contains an unsupported value')
  }
  return value
}

function normalizeRecommendationProduct(result: unknown): RecommendationProduct | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as RecommendationProduct
}
