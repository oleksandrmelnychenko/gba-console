// Served by gba-server (.NET) at GET sales/geography. The DTO is PascalCase with
// NO JsonPropertyName — mirror SalesRegionAggregateDto.cs field-for-field
// (RegionCode: string, ValueEur: decimal, ClientCount: int). The response is
// ordered by ValueEur desc.
export type SalesRegionAggregate = {
  RegionCode: string
  ValueEur: number
  ClientCount: number
}

export type GeographyMetric = 'sales' | 'debt'

export type GeographyParams = {
  metric?: GeographyMetric
  months?: number
}

// A single plotted bubble: an aggregate joined to its oblast centroid.
export type PlottedRegion = {
  code: string
  name: string
  lat: number
  lng: number
  valueEur: number
  clientCount: number
}

// Aggregates whose RegionCode is not a known Ukrainian oblast (foreign / occupied
// noise) get bucketed here instead of plotted.
export type OtherBucket = {
  count: number
  valueEur: number
  clientCount: number
}
