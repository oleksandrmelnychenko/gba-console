import { apiRequest, apiUrl, getApiLanguage } from '../../../shared/api/apiClient'
import type {
  EcommerceImageSearchDetail,
  EcommerceImageSearchFilters,
  EcommerceImageSearchListResponse,
  SalesOnlineShopFilters,
  SalesOnlineShopSale,
} from '../types'

export async function getSalesOnlineShop(
  filters: SalesOnlineShopFilters,
  signal?: AbortSignal,
): Promise<SalesOnlineShopSale[]> {
  const result = await apiRequest<unknown>('/sales/all/filtered', {
    signal,
    query: {
      fastEcommerce: true,
      forEcommerce: true,
      from: filters.from,
      fromShipments: false,
      includeDetails: false,
      limit: filters.limit,
      offset: filters.offset,
      status: filters.status === 'all' ? 'All' : filters.status,
      to: filters.to,
      type: filters.type,
      value: filters.value.trim() || undefined,
    },
  })

  return normalizeSales(result)
}

export function getEcommerceImageSearches(
  filters: EcommerceImageSearchFilters,
  signal?: AbortSignal,
): Promise<EcommerceImageSearchListResponse> {
  return apiRequest<EcommerceImageSearchListResponse>('/ecommerce/image-searches', {
    signal,
    query: {
      limit: filters.limit,
      offset: filters.offset,
      status: filters.status === 'all' ? undefined : filters.status,
      value: filters.value?.trim() || undefined,
    },
  })
}

export function getEcommerceImageSearch(
  netUid: string,
  signal?: AbortSignal,
): Promise<EcommerceImageSearchDetail> {
  return apiRequest<EcommerceImageSearchDetail>(`/ecommerce/image-searches/${netUid}`, {
    signal,
  })
}

export function getEcommerceImageSearchImageUrl(netUid: string): string {
  return apiUrl(`/ecommerce/image-searches/${netUid}/image`, getApiLanguage())
}

function normalizeSales(result: unknown): SalesOnlineShopSale[] {
  const parsedResult = parseJsonPayload(result)

  if (Array.isArray(parsedResult)) {
    return parsedResult as SalesOnlineShopSale[]
  }

  if (parsedResult && typeof parsedResult === 'object') {
    const { Data, Items, data, items } = parsedResult as {
      Data?: unknown
      Items?: unknown
      data?: unknown
      items?: unknown
    }

    if (Array.isArray(Items)) {
      return Items as SalesOnlineShopSale[]
    }

    if (Array.isArray(items)) {
      return items as SalesOnlineShopSale[]
    }

    if (Array.isArray(Data)) {
      return Data as SalesOnlineShopSale[]
    }

    if (Array.isArray(data)) {
      return data as SalesOnlineShopSale[]
    }
  }

  return []
}

function parseJsonPayload(result: unknown): unknown {
  if (typeof result !== 'string') {
    return result
  }

  const normalized = result.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}
