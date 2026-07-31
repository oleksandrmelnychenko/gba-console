export type PriceConfidence = 'high' | 'medium' | 'low'

export type CompetitorSourceKey = 'strans' | 'cargo_parts' | 'intercars' | 'omega' | 'tir_market'

export type CompetitorOfferAvailability = 'in_stock' | 'limited' | 'out_of_stock' | 'unknown'

export type CompetitorPriceOffer = {
  availability: CompetitorOfferAvailability
  delivery_text: string | null
  marketplace_name: string
  original_price_uah: number | null
  price_uah: number
  seller_name: string | null
  similarity_score: number
  source: CompetitorSourceKey
  title: string
  url: string
}

export type CompetitorPriceSearchResult = {
  ai_summary: string | null
  currency: 'UAH'
  market: 'UA'
  offers: CompetitorPriceOffer[]
  query: string
  searched_at: string
  sources_scanned: CompetitorSourceKey[]
}

export type CompetitorPriceSearchRequest = {
  market: 'UA'
  product_net_uid: string | null
  query: string
  sources: CompetitorSourceKey[]
}

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
