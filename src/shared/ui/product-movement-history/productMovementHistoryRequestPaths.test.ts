import { describe, expect, it } from 'vitest'
import {
  assortmentMovementRequestPaths,
  legacyMovementRequestPaths,
} from './productMovementHistoryRequestPaths'

describe('product movement history request scopes', () => {
  it('keeps the default legacy scope unchanged and exposes an explicit protected assortment scope', () => {
    expect(legacyMovementRequestPaths.movement).toBe('/consignments/info/movement/filtered')
    expect(legacyMovementRequestPaths.income).toBe('/consignments/info/income/filtered')
    expect(legacyMovementRequestPaths.outcome).toBe('/consignments/info/outcome/filtered')
    expect(legacyMovementRequestPaths.historicalSource).toBe('/consignments/info/movement/historical-source/filtered')
    expect(legacyMovementRequestPaths.informational).toBe('/consignments/info/movement/informational/filtered')
    expect(legacyMovementRequestPaths.movementExport).toBe('/consignments/info/movement/document/export')
    expect(legacyMovementRequestPaths.incomeExport).toBe('/consignments/info/income/document/export')
    expect(legacyMovementRequestPaths.outcomeExport).toBe('/consignments/info/outcome/document/export')

    expect(Object.values(assortmentMovementRequestPaths)).toEqual([
      '/consignments/info/assortment/movement/filtered',
      '/consignments/info/assortment/income/filtered',
      '/consignments/info/assortment/outcome/filtered',
      '/consignments/info/assortment/movement/historical-source/filtered',
      '/consignments/info/assortment/movement/informational/filtered',
      '/consignments/info/assortment/movement/document/export',
      '/consignments/info/assortment/income/document/export',
      '/consignments/info/assortment/outcome/document/export',
    ])
  })
})
