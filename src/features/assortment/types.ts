export type AssortmentBand =
  | 'dead'
  | 'slow'
  | 'overstock'
  | 'healthy'
  | 'understock'
  | 'order_to_demand'
  | string

export type AssortmentAbc = 'A' | 'B' | 'C' | string
export type AssortmentXyz = 'X' | 'Y' | 'Z' | string
export type AssortmentLifecycle = 'new' | 'growing' | 'mature' | 'declining' | 'dead' | string

export type AssortmentRow = {
  product_id: number
  qty_on_hand: number
  eur_value: number
  unit_cost_eur: number | null
  avg_price_eur: number | null
  margin_pct: number | null
  annual_units: number
  revenue_eur: number
  cover_days: number | null
  return_rate: number
  band: AssortmentBand
  xyz: AssortmentXyz
  lifecycle: AssortmentLifecycle
  health: number
  health_components?: Record<string, number>
  abc: AssortmentAbc
  name?: string | null
  vendor_code?: string | null
  [key: string]: unknown
}

export type AssortmentStockBand = {
  count: number
  eur_value: number
  qty: number
}

export type AssortmentStockRow = Pick<AssortmentRow, 'band' | 'cover_days' | 'eur_value' | 'product_id' | 'qty_on_hand'> & {
  name?: string | null
  vendor_code?: string | null
}

export type AssortmentStock = {
  as_of?: string | null
  model_version?: string | null
  total_skus: number
  total_qty: number
  total_eur_value: number
  bands: Record<string, AssortmentStockBand>
  rows: AssortmentStockRow[]
}

export type AssortmentOverviewBody = {
  by_band: Record<string, number>
  by_lifecycle: Record<string, number>
  by_abc: Record<string, number>
  by_xyz: Record<string, number>
  total_eur_value: number
  total_revenue_eur: number
  avg_health: number
  total_skus: number
}

export type AssortmentOverview = {
  as_of?: string | null
  model_version?: string | null
  count: number
  overview: AssortmentOverviewBody
}

export type AssortmentHealthParams = {
  asOfDate?: string
  band?: string
  abc?: string
  xyz?: string
  lifecycle?: string
  sort?: string
  limit?: number
  stockedOnly?: boolean
}

export type AssortmentHealth = {
  as_of?: string | null
  sort?: string
  count: number
  tasks: AssortmentRow[]
}

export type AssortmentMarginRow = Pick<
  AssortmentRow,
  'abc' | 'annual_units' | 'avg_price_eur' | 'band' | 'health' | 'lifecycle' | 'margin_pct' | 'product_id' | 'revenue_eur' | 'unit_cost_eur'
> & {
  margin_eur: number | null
  name?: string | null
  returned_units?: number
  return_rate?: number
  vendor_code?: string | null
}

export type AssortmentMargin = {
  as_of?: string | null
  leaders: AssortmentMarginRow[]
  laggards: AssortmentMarginRow[]
  negative: AssortmentMarginRow[]
  summary: Record<string, unknown>
}

export type AssortmentReturns = {
  as_of?: string | null
  min_rate?: number
  high_returns: AssortmentMarginRow[]
  summary: Record<string, unknown>
}

export type ProductDetail = AssortmentRow & { as_of?: string | null; found: boolean }

export type ProductSubstitutes = {
  as_of?: string | null
  product_id: number
  found: boolean
  target?: AssortmentRow | null
  count: number
  in_stock_count: number
  candidates: AssortmentRow[]
}
