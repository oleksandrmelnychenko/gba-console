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
  ProductRegions,
  ProductSubstitutes,
} from '../types'

const PREFIX = '/products/intelligence'

export async function getAssortmentOverview(asOfDate?: string): Promise<AssortmentOverview> {
  return apiRequest<AssortmentOverview>(`${PREFIX}/assortment/overview`, { query: { asOfDate } })
}

export async function getAssortmentHealth(params: AssortmentHealthParams = {}): Promise<AssortmentHealth> {
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
  })
}

export async function getAssortmentRegions(
  asOfDate?: string,
  windowDays = 365,
  limit = 50,
): Promise<AssortmentRegions> {
  return apiRequest<AssortmentRegions>(`${PREFIX}/assortment/regions`, { query: { asOfDate, windowDays, limit } })
}

export async function getAssortmentStock(asOfDate?: string, limit = 20): Promise<AssortmentStock> {
  return apiRequest<AssortmentStock>(`${PREFIX}/assortment/stock`, { query: { asOfDate, limit } })
}

export async function getAssortmentMargin(asOfDate?: string, limit = 20): Promise<AssortmentMargin> {
  return apiRequest<AssortmentMargin>(`${PREFIX}/assortment/margin`, { query: { asOfDate, limit } })
}

export async function getAssortmentReturns(
  asOfDate?: string,
  minRate?: number,
  limit = 20,
): Promise<AssortmentReturns> {
  return apiRequest<AssortmentReturns>(`${PREFIX}/assortment/returns`, { query: { asOfDate, minRate, limit } })
}

export async function getProduct(productId: number, asOfDate?: string): Promise<ProductDetail> {
  return apiRequest<ProductDetail>(`${PREFIX}/product/${productId}`, { query: { asOfDate } })
}

export async function getProductRegions(
  productId: number,
  asOfDate?: string,
  windowDays = 365,
  limit = 20,
): Promise<ProductRegions> {
  return apiRequest<ProductRegions>(`${PREFIX}/product/${productId}/regions`, {
    query: { asOfDate, windowDays, limit },
  })
}

export async function getProductSubstitutes(
  productId: number,
  asOfDate?: string,
  limit = 20,
): Promise<ProductSubstitutes> {
  return apiRequest<ProductSubstitutes>(`${PREFIX}/product/${productId}/substitutes`, {
    query: { asOfDate, limit },
  })
}
