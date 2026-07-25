export type SalesPredictionPoint = {
  MonthNameUK: string
  SaleAmount: number
}

export type SalesPredictionClientOption = {
  FullName?: string
  NetUid?: string
}

export type SalesPredictionProductOption = {
  Name?: string
  NetUid?: string
  VendorCode?: string
}

export type SalesPredictionChartPoint = {
  amount: number
  month: string
}

export type SalesForecastScope = 'ByClient' | 'ByProduct' | 'ByClientAndProduct'

export type SalesForecastResponseStatus =
  | 'excluded_entity'
  | 'insufficient_history'
  | 'no_scope'
  | 'partial'
  | 'ready'
  | 'unknown_identity'

export type SalesForecastHistoryStatus =
  | 'excluded_synthetic'
  | 'insufficient_history'
  | 'not_requested'
  | 'sufficient'
  | 'unknown_identity'

export type SalesForecastIdentityStatus = 'excluded_synthetic' | 'not_requested' | 'resolved' | 'unknown'

export type SalesForecastHistoryItem = {
  status: SalesForecastHistoryStatus
  month_count: number
  non_zero_month_count: number
  total_eur: number
  sufficient: boolean
}

export type SalesForecastMeta = {
  status: SalesForecastResponseStatus
  as_of: string
  requested_as_of: string
  horizon_months: number
  currency: 'EUR'
  model_version: string
  source_fingerprint: string
  requested: {
    client_net_id: string | null
    product_net_id: string | null
  }
  resolved: {
    client_id: number | null
    client_net_id: string | null
    product_id: number | null
    product_net_id: string | null
  }
  identity: {
    client: SalesForecastIdentityStatus
    product: SalesForecastIdentityStatus
  }
  history_window_months: number
  minimum_non_zero_months: number
  history: Record<SalesForecastScope, SalesForecastHistoryItem>
}

export type SalesForecastResponse = Record<SalesForecastScope, SalesPredictionPoint[]> & {
  meta: SalesForecastMeta
}

export type SalesForecastRequestOptions = {
  asOfDate?: string
  months?: number
  signal?: AbortSignal
  useCache?: boolean
}
