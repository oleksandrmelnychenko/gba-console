import { expect, it } from 'vitest'
import { partialPhysicalCoverage } from '../../../shared/ui/product-movement-history/physicalCoverage.test-fixtures'
import { normalizeCurrentVparivanieRegional } from './currentVparivanieRegional'
import { regionalRequest, regionalResult } from './currentVparivanieRegional.test-fixtures'
import { buildStockMovementRequest, defaultStockMovementDraft, normalizeStockMovementResult } from './warehouseStockMovement'
import { stockMovementCapability, stockMovementResult } from '../testing/warehouseStockMovementFixtures'

const request = buildStockMovementRequest(defaultStockMovementDraft(stockMovementCapability))

it.each([false, true])('preserves valid coverage in regional and warehouse responses, empty=%s', empty => {
  const regional = regionalResult()
  if (empty) {
    regional.Rows = []; regional.ProductCount = 0
    regional.StockFacts = 0; regional.SaleFacts = 0; regional.ReturnFacts = 0; regional.CounterpartyFacts = 0
  }
  const warehouse = stockMovementResult(request, empty ? [] : undefined)
  expect(normalizeCurrentVparivanieRegional({ ...regional, PhysicalCoverage: [partialPhysicalCoverage] }, regionalRequest()).PhysicalCoverage)
    .toEqual([partialPhysicalCoverage])
  expect(normalizeStockMovementResult({ ...warehouse, PhysicalCoverage: [partialPhysicalCoverage] }, request).PhysicalCoverage)
    .toEqual([partialPhysicalCoverage])
})

it.each([false, {}, [{ ...partialPhysicalCoverage, ImportedPeriodComplete: 'false' }]])('refuses malformed present coverage %j', PhysicalCoverage => {
  expect(() => normalizeCurrentVparivanieRegional({ ...regionalResult(), PhysicalCoverage }, regionalRequest())).toThrow('межі історії')
  expect(() => normalizeStockMovementResult({ ...stockMovementResult(request), PhysicalCoverage }, request)).toThrow('межі історії')
})

it('preserves coverage through the warehouse camelCase wire adapter', () => {
  const physicalCoverage = [{ ...Object.fromEntries(Object.entries(partialPhysicalCoverage).map(([key, value]) =>
    [key[0].toLowerCase() + key.slice(1), value])) }]
  expect(normalizeStockMovementResult({ ...stockMovementResult(request), physicalCoverage }, request).PhysicalCoverage)
    .toEqual([partialPhysicalCoverage])
})
