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

export type PriceRecommendation = {
  product_id: number
  client_agreement_netuid: string
  currency: string
  baseline_price: number | null
  recommended_price: number | null
  price_floor: number | null
  unit_cost_eur: number | null
  suggested_discount_pct: number | null
  discount_band: DiscountBand | null
  peer_band: PeerBand
  confidence: PriceConfidence
  margin_pct_at_recommended: number | null
  rationale: string
  as_of_date: string | null
  model_version: string
}
