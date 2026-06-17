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
