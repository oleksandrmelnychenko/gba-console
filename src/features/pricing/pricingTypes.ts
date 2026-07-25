export type PriceConfidence = 'high' | 'medium' | 'low'

export type DiscountBand = {
  min_pct: number
  target_pct: number
  max_pct: number
}

export type PeerBand = {
  p25: number | null
  p50: number | null
  p75: number | null
  n: number
}

export type PriceRecommendation = AiHistoryLineage & {
  product_id: number
  product_net_uid: string
  client_agreement_netuid: string
  currency: string
  baseline_price: number | null
  baseline_source: string | null
  recommended_price: number | null
  price_floor: number | null
  unit_cost_eur: number | null
  suggested_discount_pct: number | null
  discount_band: DiscountBand | null
  peer_band: PeerBand
  confidence: PriceConfidence
  margin_pct_at_recommended: number | null
  elasticity: number | null
  elasticity_source: string | null
  elastic_optimal_price: number | null
  rationale: string
  requested_start: string
  history_fingerprint: string
  model_fingerprint: string
  as_of_date: string
  model_version: string
}
import type { AiHistoryLineage } from '../../shared/ai/aiHistoryLineage'
