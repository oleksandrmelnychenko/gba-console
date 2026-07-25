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
  currency_id: number
  turnover_eur: number
  exposure_eur: number
}

export type ForwardRiskBand = 'low' | 'medium' | 'high' | 'very_high'
export type ForwardRiskStatus = 'available' | 'model_unavailable' | 'not_applicable'

export type Contribution = {
  feature: string
  value?: number | null
  points: number
}

export type ForwardRisk = {
  band: ForwardRiskBand
  pd: number
}

export type SolvencyScore = {
  client_id: number
  client_net_uid: string | null
  applicable: boolean
  score: number | null
  rating: SolvencyRating | null
  pd?: number | null
  contributions?: Contribution[] | null
  forward_risk?: ForwardRisk | null
  forward_risk_status: ForwardRiskStatus
  forward_risk_reason: string | null
  sub_factors: SubFactors | null
  caps_applied: string[]
  debt_load_source: SolvencyDebtLoadSource | null
  raw_score: number | null
  currency_breakdown: CurrencyExposure[] | null
  data_sufficiency?: 'insufficient' | 'ok' | null
  data_sufficiency_reason?: string | null
  source_history_start: string
  effective_start: string
  history_complete: boolean
  as_of_date: string | null
  window_months: number
  model_version: string
}

export type SolvencyBatchError = {
  client_id: number
  error: string
}

export type SolvencyBatch = {
  results: SolvencyScore[]
  errors: SolvencyBatchError[]
  count: number
  failed: number
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
  applicable: boolean
  limit_utilization_gauge: GaugeChart
  payment_discipline_donut: DonutSlice[]
  open_invoice_aging_bars: AgingBar[]
  turnover_vs_exposure: TurnoverExposurePoint[]
  score_sparkline: ScorePoint[]
  turnover_trend: TrendPoint[]
  aging_over_time_heatmap: string
  source_history_start: string
  effective_start: string
  history_complete: boolean
  as_of_date: string | null
  window_months: number
  model_version: string
}
