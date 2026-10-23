import { describe, expect, it } from 'vitest'
import { geographySummary } from '../testFixtures'
import { splitGeographyRegions, formatGeographyMoney } from './salesGeographyPresentation'

describe('geography presentation', () => {
  it('keeps Poltava on map and foreign and unknown regions in totals exactly once', () => {
    const rows = geographySummary().Rows
    rows.push({ RegionCode: 'PL', ValueEur: 10, KnownValueEur: 10, ClientCount: 2, UnresolvedAmountCount: 0 })
    rows.push({ RegionCode: null, ValueEur: -4, KnownValueEur: -4, ClientCount: 1, UnresolvedAmountCount: 0 })
    const result = splitGeographyRegions(rows)
    expect(result.regions).toHaveLength(4)
    expect(result.plotted.map(row => row.code)).toEqual(['PA', 'LV'])
    expect(result.other).toEqual({ count: 2, valueEur: 6, knownValueEur: 6, clientCount: 3, unresolvedAmountCount: 0 })
    expect(result.regions[3].name).toBe('Без регіону')
  })
  it('never substitutes an unknown outside-map total with its known partial amount', () => {
    const result = splitGeographyRegions([{ RegionCode: null, ValueEur: null, KnownValueEur: 10, ClientCount: 2, UnresolvedAmountCount: 1 }])
    expect(result.other.valueEur).toBeNull()
    expect(result.other.knownValueEur).toBe(10)
  })
  it('formats all money to cents including zero and negative returns', () => {
    expect(formatGeographyMoney(1.4)).toBe('€1,40')
    expect(formatGeographyMoney(2.8)).toBe('€2,80')
    expect(formatGeographyMoney(0)).toBe('€0,00')
    expect(formatGeographyMoney(-1.4)).toBe('€-1,40')
  })
})
