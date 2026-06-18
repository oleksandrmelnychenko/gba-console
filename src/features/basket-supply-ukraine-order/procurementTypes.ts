export type ProcurementUrgency = 'critical' | 'high' | 'normal' | 'none'

export type ProcurementUrgencyBucket = {
  urgency: string
  count: number
}

export type ProcurementDaysOfCoverBucket = {
  bucket: string
  count: number
}

export type ProcurementTopItem = {
  product_id: number
  suggested_qty: number
  on_hand: number
  reorder_point: number
  urgency: string
}

export type ProcurementDemandPoint = {
  period: string
  units: number
  is_forecast: boolean
}

export type ProcurementDemandSeries = {
  product_id: number
  points: ProcurementDemandPoint[]
}

export type ProcurementCharts = {
  producer_id: number | null
  as_of_date: string | null
  top_n: number
  urgency_mix: ProcurementUrgencyBucket[]
  days_of_cover_hist: ProcurementDaysOfCoverBucket[]
  top_items: ProcurementTopItem[]
  demand_series: ProcurementDemandSeries[]
}

export type ProcurementChartsQuery = {
  producerId?: number
  topN?: number
}

export type ReorderForecast = {
  mean_daily: number
  std_daily: number
  method: string
  horizon_days: number
  forecast_units: number
}

export type ReorderInventory = {
  on_hand: number
  reserved: number
  on_order: number
  available: number
  position: number
}

export type ReorderCheaperAlt = {
  producer_id: number
  cost_eur: number
}

export type ReorderSuggestion = {
  product_id: number
  producer_id: number
  suggested_qty: number
  reorder_point: number
  safety_stock: number
  days_of_cover: number
  urgency: ProcurementUrgency
  reason: string
  forecast: ReorderForecast
  inventory: ReorderInventory
  unit_cost_eur: number | null
  line_cost_eur: number | null
  unit_sale_eur: number | null
  unit_margin_eur: number | null
  applied_service_level: number | null
  abc: string | null
  xyz: string | null
  quadrant: string | null
  cheaper_alt: ReorderCheaperAlt | null
}

export type ProducerPlan = {
  producer_id: number | null
  producer_name: string
  lead_time_days: number
  lead_time_std_days: number
  lead_time_source: string
  item_count: number
  as_of_date: string | null
  model_version: string
  items: ReorderSuggestion[]
}
