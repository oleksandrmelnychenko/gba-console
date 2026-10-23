import type { GeographyRegion, OtherBucket, PlottedRegion, SalesRegionAggregate } from '../types'
import { OBLAST_CENTROIDS } from './oblastCentroids'

export function splitGeographyRegions(rows: SalesRegionAggregate[]) {
  const plotted: PlottedRegion[] = []
  const regions: GeographyRegion[] = []
  const other: OtherBucket = { count: 0, valueEur: 0, knownValueEur: 0, clientCount: 0, unresolvedAmountCount: 0 }
  for (const row of rows) {
    const centroid = row.RegionCode === null ? undefined : OBLAST_CENTROIDS[row.RegionCode]
    const region: GeographyRegion = {
      code: row.RegionCode ?? 'unassigned',
      name: centroid?.name ?? row.RegionCode ?? 'Без регіону',
      valueEur: row.ValueEur,
      knownValueEur: row.KnownValueEur,
      clientCount: row.ClientCount,
      unresolvedAmountCount: row.UnresolvedAmountCount,
    }
    regions.push(region)
    if (centroid) plotted.push({ ...region, lat: centroid.lat, lng: centroid.lng })
    else {
      other.count++
      other.knownValueEur += row.KnownValueEur
      other.clientCount += row.ClientCount
      other.unresolvedAmountCount += row.UnresolvedAmountCount
    }
  }
  other.valueEur = other.unresolvedAmountCount > 0 ? null : other.knownValueEur
  return { regions, plotted, other }
}

export function displayCalendarDate(value: string): string {
  return value.split('-').reverse().join('.')
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatGeographyMoney = (value: number) => `€${moneyFormatter.format(value)}`
