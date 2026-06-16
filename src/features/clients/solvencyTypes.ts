export type SolvencyRating = 'A' | 'B' | 'C' | 'D'

export type SolvencyDebtLoadSource = 'debt_table' | 'live_proxy'

export type SubFactor = {
  value: number
  points: number
  weight: number
}

export type SubFactors = {
  discipline: SubFactor
  debt_load: SubFactor
  activity: SubFactor
  tenure: SubFactor
  return_quality: SubFactor
}

export type CurrencyExposure = {
  currency_id: number | null
  turnover_eur: number
  exposure_eur?: number
}

export type SolvencyScore = {
  client_id: number
  score: number
  rating: SolvencyRating
  sub_factors: SubFactors
  caps_applied: string[]
  debt_load_source: SolvencyDebtLoadSource
  raw_score: number
  currency_breakdown: CurrencyExposure[] | null
  as_of_date: string | null
  window_months: number
  model_version: string
}

export type GaugeChart = {
  value: number
  threshold_soft: number
  threshold_hard: number
  label: string
}

export type DonutSlice = {
  label: string
  count: number
}

export type AgingBar = {
  bucket: string
  count: number
  amount_eur?: number | null
}

export type TurnoverExposurePoint = {
  period: string
  turnover_eur: number
  exposure_eur: number
}

export type ScorePoint = {
  period: string
  score: number
}

export type TrendPoint = {
  period: string
  turnover_eur: number
}

export type SolvencyCharts = {
  client_id: number
  limit_utilization_gauge: GaugeChart
  payment_discipline_donut: DonutSlice[]
  open_invoice_aging_bars: AgingBar[]
  turnover_vs_exposure: TurnoverExposurePoint[]
  score_sparkline: ScorePoint[]
  turnover_trend: TrendPoint[]
  aging_over_time_heatmap: string
  as_of_date: string | null
  window_months: number
  model_version: string
}
