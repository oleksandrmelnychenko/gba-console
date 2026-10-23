export type SalesRegionAggregate = {
  RegionCode: string | null
  ValueEur: number | null
  KnownValueEur: number
  ClientCount: number
  UnresolvedAmountCount: number
}

export type GeographyMetric = 'sales' | 'debt'

export type SalesGeographySummary = {
  Metric: GeographyMetric
  Currency: 'EUR'
  TimeZone: 'Europe/Kyiv'
  From: string | null
  To: string | null
  AvailableFrom: string | null
  LatestDocumentDate: string | null
  AsOfUtc: string
  AmountBasis: 'confirmed-invoices-minus-active-returns-with-vat' | 'current-positive-receivables-historical-fx'
  RegionBasis: 'current-client-region'
  ImportCompletenessConfirmed: boolean
  UnresolvedUnit: 'lines' | 'debts'
  Rows: SalesRegionAggregate[]
  TotalEur: number | null
  KnownTotalEur: number
  ClientCount: number
  UnresolvedAmountCount: number
}

export type GeographyPeriod = 'all'

export type GeographyParams = {
  metric?: GeographyMetric
  period?: GeographyPeriod
  months?: number
  from?: string
  to?: string
}

export type GeographyRegion = {
  code: string
  name: string
  valueEur: number | null
  knownValueEur: number
  clientCount: number
  unresolvedAmountCount: number
}

export type PlottedRegion = GeographyRegion & { lat: number; lng: number }

export type OtherBucket = {
  count: number
  valueEur: number | null
  knownValueEur: number
  clientCount: number
  unresolvedAmountCount: number
}
