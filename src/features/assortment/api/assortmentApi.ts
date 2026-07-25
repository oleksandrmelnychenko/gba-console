import { apiRequest } from '../../../shared/api/apiClient'
import {
  normalizeAiHistoryLineage,
  requireAiIsoDate,
} from '../../../shared/ai/aiHistoryLineage'
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

export class ProductIntelligenceContractError extends Error {
  constructor(path: string, reason: string) {
    super(`Некоректна відповідь AI Product Intelligence (${path}): ${reason}`)
    this.name = 'ProductIntelligenceContractError'
  }
}

export async function getAssortmentOverview(asOfDate?: string, signal?: AbortSignal): Promise<AssortmentOverview> {
  const result = await apiRequest<unknown>(`${PREFIX}/assortment/overview`, { query: { asOfDate }, signal })
  return normalizeHistoryResponse<AssortmentOverview>(result, 'assortment_overview', asOfDate)
}

export async function getAssortmentHealth(
  params: AssortmentHealthParams = {},
  signal?: AbortSignal,
): Promise<AssortmentHealth> {
  const result = await apiRequest<unknown>(`${PREFIX}/assortment/health`, {
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
  return normalizeHistoryResponse<AssortmentHealth>(result, 'assortment_health', params.asOfDate)
}

export async function getAssortmentRegions(
  asOfDate?: string,
  windowDays = 365,
  limit = 50,
  signal?: AbortSignal,
): Promise<AssortmentRegions> {
  const result = await apiRequest<unknown>(`${PREFIX}/assortment/regions`, {
    query: { asOfDate, windowDays, limit },
    signal,
  })
  return normalizeHistoryResponse<AssortmentRegions>(result, 'assortment_regions', asOfDate)
}

export async function getAssortmentStock(
  asOfDate?: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<AssortmentStock> {
  const result = await apiRequest<unknown>(`${PREFIX}/assortment/stock`, { query: { asOfDate, limit }, signal })
  return normalizeHistoryResponse<AssortmentStock>(result, 'assortment_stock', asOfDate)
}

export async function getAssortmentMargin(
  asOfDate?: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<AssortmentMargin> {
  const result = await apiRequest<unknown>(`${PREFIX}/assortment/margin`, { query: { asOfDate, limit }, signal })
  return normalizeHistoryResponse<AssortmentMargin>(result, 'assortment_margin', asOfDate)
}

export async function getAssortmentReturns(
  asOfDate?: string,
  minRate?: number,
  limit = 20,
  signal?: AbortSignal,
): Promise<AssortmentReturns> {
  const result = await apiRequest<unknown>(`${PREFIX}/assortment/returns`, {
    query: { asOfDate, minRate, limit },
    signal,
  })
  return normalizeHistoryResponse<AssortmentReturns>(result, 'assortment_returns', asOfDate)
}

export async function getProduct(productId: number, asOfDate?: string, signal?: AbortSignal): Promise<ProductDetail> {
  const result = await apiRequest<unknown>(`${PREFIX}/product/${productId}`, { query: { asOfDate }, signal })
  return normalizeHistoryResponse<ProductDetail>(result, 'product', asOfDate)
}

export async function getProductAnalytics(
  productId: number,
  asOfDate?: string,
  months = 12,
  signal?: AbortSignal,
): Promise<ProductAnalytics> {
  const result = await apiRequest<unknown>(`${PREFIX}/product/${productId}/analytics`, {
    query: { asOfDate, months },
    signal,
  })
  return normalizeProductAnalytics(result, asOfDate)
}

export async function getProductRegions(
  productId: number,
  asOfDate?: string,
  windowDays = 365,
  limit = 20,
  signal?: AbortSignal,
): Promise<ProductRegions> {
  const result = await apiRequest<unknown>(`${PREFIX}/product/${productId}/regions`, {
    query: { asOfDate, windowDays, limit },
    signal,
  })
  return normalizeHistoryResponse<ProductRegions>(result, 'product_regions', asOfDate)
}

export async function getProductSubstitutes(
  productId: number,
  asOfDate?: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<ProductSubstitutes> {
  const result = await apiRequest<unknown>(`${PREFIX}/product/${productId}/substitutes`, {
    query: { asOfDate, limit },
    signal,
  })
  return normalizeHistoryResponse<ProductSubstitutes>(result, 'product_substitutes', asOfDate)
}

function normalizeHistoryResponse<T>(
  result: unknown,
  path: string,
  expectedAsOf?: string,
): T {
  const value = requireRecord(result, path)
  const asOf = requireAiIsoDate(value.as_of, `${path}.as_of`, createContractError)
  const lineage = normalizeAiHistoryLineage(value, path, createContractError, {
    asOf,
    ...(expectedAsOf ? { expectedAsOf } : {}),
    requireRequestedStart: true,
  })
  requireNonEmptyString(value.history_fingerprint, `${path}.history_fingerprint`)

  const windows = requireRecord(value.history_windows, `${path}.history_windows`)
  const entries = Object.entries(windows)
  if (entries.length === 0) {
    throw new ProductIntelligenceContractError(
      `${path}.history_windows`,
      'must contain at least one window',
    )
  }

  const normalizedWindows = entries.map(([name, rawWindow]) => {
    const windowPath = `${path}.history_windows.${name}`
    const window = requireRecord(rawWindow, windowPath)
    const proof = normalizeAiHistoryLineage(
      { ...window, effective_history_days: window.effective_days },
      windowPath,
      createContractError,
      {
        asOf,
        requireEffectiveHistoryDays: true,
        requireRequestedStart: true,
      },
    )
    if (proof.source_history_start !== lineage.source_history_start) {
      throw new ProductIntelligenceContractError(
        `${windowPath}.source_history_start`,
        'must match the top-level source history',
      )
    }
    return proof
  })

  const requestedStarts = normalizedWindows.map((window) => window.requested_start!)
  const effectiveStarts = normalizedWindows.map((window) => window.effective_start)
  if (lineage.requested_start !== requestedStarts.toSorted()[0]) {
    throw new ProductIntelligenceContractError(
      `${path}.requested_start`,
      'must equal the earliest requested history window',
    )
  }
  if (lineage.effective_start !== effectiveStarts.toSorted()[0]) {
    throw new ProductIntelligenceContractError(
      `${path}.effective_start`,
      'must equal the earliest effective history window',
    )
  }
  if (lineage.history_complete !== normalizedWindows.every((window) => window.history_complete)) {
    throw new ProductIntelligenceContractError(
      `${path}.history_complete`,
      'must summarize all history windows',
    )
  }

  return value as unknown as T
}

function normalizeProductAnalytics(result: unknown, expectedAsOf?: string): ProductAnalytics {
  const path = 'product_analytics'
  const value = requireRecord(result, path)
  const asOf = requireAiIsoDate(value.as_of, `${path}.as_of`, createContractError)
  const lineage = normalizeAiHistoryLineage(value, path, createContractError, {
    asOf,
    ...(expectedAsOf ? { expectedAsOf } : {}),
    requireRequestedStart: true,
  })
  requireNonEmptyString(value.history_fingerprint, `${path}.history_fingerprint`)

  const rawWindow = requireRecord(value.window, `${path}.window`)
  const window = normalizeAiHistoryLineage(
    { ...rawWindow, effective_history_days: rawWindow.effective_days },
    `${path}.window`,
    createContractError,
    {
      asOf,
      requireEffectiveHistoryDays: true,
      requireRequestedStart: true,
    },
  )
  assertSameLineage(lineage, window, `${path}.window`)

  const dataQuality = requireRecord(value.data_quality, `${path}.data_quality`)
  const quality = normalizeAiHistoryLineage(
    dataQuality,
    `${path}.data_quality`,
    createContractError,
    {
      asOf,
      requireRequestedStart: true,
    },
  )
  assertSameLineage(lineage, quality, `${path}.data_quality`)
  if (dataQuality.zero_fill_begins_at !== lineage.effective_start) {
    throw new ProductIntelligenceContractError(
      `${path}.data_quality.zero_fill_begins_at`,
      'must equal effective_start',
    )
  }

  return value as unknown as ProductAnalytics
}

function assertSameLineage(
  expected: ReturnType<typeof normalizeAiHistoryLineage>,
  actual: ReturnType<typeof normalizeAiHistoryLineage>,
  path: string,
) {
  if (
    expected.source_history_start !== actual.source_history_start ||
    expected.requested_start !== actual.requested_start ||
    expected.effective_start !== actual.effective_start ||
    expected.history_complete !== actual.history_complete
  ) {
    throw new ProductIntelligenceContractError(path, 'history proof differs from the top level')
  }
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProductIntelligenceContractError(path, 'expected an object')
  }
  return value as Record<string, unknown>
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ProductIntelligenceContractError(path, 'expected a non-empty string')
  }
  return value
}

function createContractError(path: string, reason: string): ProductIntelligenceContractError {
  return new ProductIntelligenceContractError(path, reason)
}
