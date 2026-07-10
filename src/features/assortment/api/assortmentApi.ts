import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AssortmentHealth,
  AssortmentHealthParams,
  AssortmentMargin,
  AssortmentOverview,
  AssortmentRegions,
  AssortmentReturns,
  AssortmentStock,
  ProductDetail,
  ProductAnalytics,
  ProductRegions,
  ProductSubstitutes,
} from '../types'

const PREFIX = '/products/intelligence'

export async function getAssortmentOverview(asOfDate?: string, signal?: AbortSignal): Promise<AssortmentOverview> {
  return apiRequest<AssortmentOverview>(`${PREFIX}/assortment/overview`, { query: { asOfDate }, signal })
}

export async function getAssortmentHealth(
  params: AssortmentHealthParams = {},
  signal?: AbortSignal,
): Promise<AssortmentHealth> {
  return apiRequest<AssortmentHealth>(`${PREFIX}/assortment/health`, {
    query: {
      asOfDate: params.asOfDate,
      band: params.band,
      abc: params.abc,
      xyz: params.xyz,
      lifecycle: params.lifecycle,
      sort: params.sort ?? 'health_asc',
      limit: params.limit ?? 100,
      stockedOnly: params.stockedOnly ?? true,
      regionId: params.regionId,
      regionWindowDays: params.regionWindowDays,
    },
    signal,
  })
}

export async function getAssortmentRegions(
  asOfDate?: string,
  windowDays = 365,
  limit = 50,
  signal?: AbortSignal,
): Promise<AssortmentRegions> {
  return apiRequest<AssortmentRegions>(`${PREFIX}/assortment/regions`, {
    query: { asOfDate, windowDays, limit },
    signal,
  })
}

export async function getAssortmentStock(
  asOfDate?: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<AssortmentStock> {
  return apiRequest<AssortmentStock>(`${PREFIX}/assortment/stock`, { query: { asOfDate, limit }, signal })
}

export async function getAssortmentMargin(
  asOfDate?: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<AssortmentMargin> {
  return apiRequest<AssortmentMargin>(`${PREFIX}/assortment/margin`, { query: { asOfDate, limit }, signal })
}

export async function getAssortmentReturns(
  asOfDate?: string,
  minRate?: number,
  limit = 20,
  signal?: AbortSignal,
): Promise<AssortmentReturns> {
  return apiRequest<AssortmentReturns>(`${PREFIX}/assortment/returns`, {
    query: { asOfDate, minRate, limit },
    signal,
  })
}

export async function getProduct(productId: number, asOfDate?: string, signal?: AbortSignal): Promise<ProductDetail> {
  return apiRequest<ProductDetail>(`${PREFIX}/product/${productId}`, { query: { asOfDate }, signal })
}

export async function getProductAnalytics(
  productId: number,
  asOfDate?: string,
  months = 12,
  signal?: AbortSignal,
): Promise<ProductAnalytics> {
  return apiRequest<ProductAnalytics>(`${PREFIX}/product/${productId}/analytics`, {
    query: { asOfDate, months },
    signal,
  })
}

export async function getProductRegions(
  productId: number,
  asOfDate?: string,
  windowDays = 365,
  limit = 20,
  signal?: AbortSignal,
): Promise<ProductRegions> {
  return apiRequest<ProductRegions>(`${PREFIX}/product/${productId}/regions`, {
    query: { asOfDate, windowDays, limit },
    signal,
  })
}

export async function getProductSubstitutes(
  productId: number,
  asOfDate?: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<ProductSubstitutes> {
  return apiRequest<ProductSubstitutes>(`${PREFIX}/product/${productId}/substitutes`, {
    query: { asOfDate, limit },
    signal,
  })
}
