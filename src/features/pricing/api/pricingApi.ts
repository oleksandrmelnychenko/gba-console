import { apiRequest } from '../../../shared/api/apiClient'
import {
  normalizeAiHistoryLineage,
  requireAiIsoDate,
} from '../../../shared/ai/aiHistoryLineage'
import type { DiscountBand, PeerBand, PriceConfidence, PriceRecommendation } from '../pricingTypes'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRICE_CONFIDENCES: PriceConfidence[] = ['high', 'medium', 'low']
const CENT_EPSILON = 1e-7

export class PricingContractError extends Error {
  constructor(path: string, reason: string) {
    super(`Некоректна відповідь AI Pricing (${path}): ${reason}`)
    this.name = 'PricingContractError'
  }
}

export async function getPriceRecommendation(
  productNetId: string,
  clientAgreementNetId: string,
  culture = 'uk',
  withVat = true,
  signal?: AbortSignal,
): Promise<PriceRecommendation> {
  const requestedProductNetId = requireGuid(productNetId, 'request.product_net_uid')
  const requestedAgreementNetId = requireGuid(clientAgreementNetId, 'request.client_agreement_netuid')
  const result = await apiRequest<unknown>('/pricing/recommend', {
    query: {
      productNetId: requestedProductNetId,
      clientAgreementNetId: requestedAgreementNetId,
      culture,
      withVat,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeRecommendation(result, requestedProductNetId, requestedAgreementNetId)
}

function normalizeRecommendation(
  result: unknown,
  requestedProductNetId: string,
  requestedAgreementNetId: string,
): PriceRecommendation {
  const value = requireRecord(result, 'recommendation')
  const productNetUid = requireGuid(value.product_net_uid, 'recommendation.product_net_uid')
  const agreementNetUid = requireGuid(
    value.client_agreement_netuid,
    'recommendation.client_agreement_netuid',
  )
  if (productNetUid !== requestedProductNetId || agreementNetUid !== requestedAgreementNetId) {
    throw new PricingContractError('recommendation.identity', 'does not echo the request')
  }
  if (value.currency !== 'EUR') {
    throw new PricingContractError('recommendation.currency', 'must be EUR')
  }
  const asOfDate = requireAiIsoDate(
    value.as_of_date,
    'recommendation.as_of_date',
    createPricingContractError,
  )
  const historyLineage = normalizeAiHistoryLineage(
    value,
    'recommendation',
    createPricingContractError,
    {
      asOf: asOfDate,
      requireRequestedStart: true,
    },
  )

  const baselinePrice = requireNullableMoney(value.baseline_price, 'recommendation.baseline_price')
  const recommendedPrice = requireNullableMoney(
    value.recommended_price,
    'recommendation.recommended_price',
  )
  const priceFloor = requireNullableMoney(value.price_floor, 'recommendation.price_floor')
  const unitCostEur = requireNullableMoney(value.unit_cost_eur, 'recommendation.unit_cost_eur')
  const elasticOptimalPrice = requireNullableMoney(
    value.elastic_optimal_price,
    'recommendation.elastic_optimal_price',
  )
  const peerBand = normalizePeerBand(value.peer_band)
  const discountBand = value.discount_band === null ? null : normalizeDiscountBand(value.discount_band)

  if (recommendedPrice !== null) {
    if (baselinePrice === null) {
      throw new PricingContractError(
        'recommendation.recommended_price',
        'requires a baseline price',
      )
    }
    if (priceFloor !== null && recommendedPrice < priceFloor) {
      throw new PricingContractError(
        'recommendation.recommended_price',
        'cannot be below price_floor',
      )
    }
  }

  const confidence = value.confidence
  if (typeof confidence !== 'string' || !PRICE_CONFIDENCES.includes(confidence as PriceConfidence)) {
    throw new PricingContractError('recommendation.confidence', 'contains an unsupported value')
  }

  return {
    product_id: requirePositiveInteger(value.product_id, 'recommendation.product_id'),
    product_net_uid: productNetUid,
    client_agreement_netuid: agreementNetUid,
    currency: 'EUR',
    baseline_price: baselinePrice,
    baseline_source: requireNullableString(value.baseline_source, 'recommendation.baseline_source'),
    recommended_price: recommendedPrice,
    price_floor: priceFloor,
    unit_cost_eur: unitCostEur,
    suggested_discount_pct: requireNullablePercent(
      value.suggested_discount_pct,
      'recommendation.suggested_discount_pct',
    ),
    discount_band: discountBand,
    peer_band: peerBand,
    confidence: confidence as PriceConfidence,
    margin_pct_at_recommended: requireNullablePercent(
      value.margin_pct_at_recommended,
      'recommendation.margin_pct_at_recommended',
    ),
    elasticity: requireNullablePositiveNumber(value.elasticity, 'recommendation.elasticity'),
    elasticity_source: requireNullableString(
      value.elasticity_source,
      'recommendation.elasticity_source',
    ),
    elastic_optimal_price: elasticOptimalPrice,
    rationale: requireNonEmptyString(value.rationale, 'recommendation.rationale'),
    ...historyLineage,
    requested_start: historyLineage.requested_start!,
    history_fingerprint: requireNonEmptyString(
      value.history_fingerprint,
      'recommendation.history_fingerprint',
    ),
    model_fingerprint: requireNonEmptyString(
      value.model_fingerprint,
      'recommendation.model_fingerprint',
    ),
    as_of_date: asOfDate,
    model_version: requireNonEmptyString(value.model_version, 'recommendation.model_version'),
  }
}

function createPricingContractError(path: string, reason: string): PricingContractError {
  return new PricingContractError(path, reason)
}

function normalizePeerBand(value: unknown): PeerBand {
  const band = requireRecord(value, 'recommendation.peer_band')
  const p25 = requireNullableMoney(band.p25, 'recommendation.peer_band.p25')
  const p50 = requireNullableMoney(band.p50, 'recommendation.peer_band.p50')
  const p75 = requireNullableMoney(band.p75, 'recommendation.peer_band.p75')

  const percentiles = [p25, p50, p75].filter((entry): entry is number => entry !== null)
  if (percentiles.some((entry, index) => index > 0 && percentiles[index - 1] > entry)) {
    throw new PricingContractError('recommendation.peer_band', 'percentiles must be monotone')
  }

  return {
    p25,
    p50,
    p75,
    n: requireNonNegativeInteger(band.n, 'recommendation.peer_band.n'),
  }
}

function normalizeDiscountBand(value: unknown): DiscountBand {
  const band = requireRecord(value, 'recommendation.discount_band')
  const min = requirePercent(band.min_pct, 'recommendation.discount_band.min_pct')
  const target = requirePercent(band.target_pct, 'recommendation.discount_band.target_pct')
  const max = requirePercent(band.max_pct, 'recommendation.discount_band.max_pct')

  if (!(min <= target && target <= max)) {
    throw new PricingContractError('recommendation.discount_band', 'must be monotone')
  }

  return { min_pct: min, target_pct: target, max_pct: max }
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PricingContractError(path, 'expected an object')
  }

  return value as Record<string, unknown>
}

function requireGuid(value: unknown, path: string): string {
  const guid = requireNonEmptyString(value, path).toLowerCase()
  if (!GUID_PATTERN.test(guid)) {
    throw new PricingContractError(path, 'must be a GUID')
  }

  return guid
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PricingContractError(path, 'expected a non-empty string')
  }

  return value
}

function requireNullableString(value: unknown, path: string): string | null {
  if (value === null) {
    return null
  }

  return requireNonEmptyString(value, path)
}

function requirePositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new PricingContractError(path, 'must be a positive integer')
  }

  return value
}

function requireNonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new PricingContractError(path, 'must be a non-negative integer')
  }

  return value
}

function requireNullableMoney(value: unknown, path: string): number | null {
  if (value === null) {
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new PricingContractError(path, 'must be null or a finite non-negative amount')
  }
  if (Math.abs(value * 100 - Math.round(value * 100)) > CENT_EPSILON) {
    throw new PricingContractError(path, 'must be rounded to cents')
  }

  return value
}

function requirePercent(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new PricingContractError(path, 'must be a percentage from 0 to 100')
  }

  return value
}

function requireNullablePercent(value: unknown, path: string): number | null {
  return value === null ? null : requirePercent(value, path)
}

function requireNullablePositiveNumber(value: unknown, path: string): number | null {
  if (value === null) {
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new PricingContractError(path, 'must be null or a finite positive number')
  }

  return value
}
