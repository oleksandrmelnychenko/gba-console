import { expect, it } from 'vitest'
import { currentVparivanieDataset } from './currentVparivanie.test-fixtures'
import { currentVparivanieRegionalAvailable, normalizeCurrentVparivanieRegional } from './currentVparivanieRegional'
import { regionalDataset, regionalRequest, regionalResult } from './currentVparivanieRegional.test-fixtures'

it('accepts the normal month and dynamic cohort while preserving exact quantities and parent/region distinction', () => {
  expect(currentVparivanieRegionalAvailable(currentVparivanieDataset)).toBe(false)
  expect(currentVparivanieRegionalAvailable(regionalDataset)).toBe(true)
  const result = normalizeCurrentVparivanieRegional(regionalResult(), regionalRequest())
  expect(result.Rows[0].Cells[0].Quantity).toBe('9007199254740993.00000001')
  expect(result.Rows[0].Cells.map(cell => cell.Column)).toEqual(['Stock', 'Sales', 'CounterpartyTotal', 'CounterpartyRegionCode'])
  expect(result.ProductCount).toBe(1)
})

it('keeps an empty code distinct from its parent and permits a known parent with an unknown regional child', () => {
  const empty = regionalResult(); empty.Rows[0].Cells[3].RegionCode = ''
  expect(normalizeCurrentVparivanieRegional(empty, regionalRequest()).Rows[0].Cells[3].RegionCode).toBe('')
  const unknown = regionalResult(); unknown.Rows[0].Cells[3] = {
    Column: 'CounterpartyUnknown', RegionCode: null, Quantity: null, UnitId: null, FactCount: 3,
  }
  const result = normalizeCurrentVparivanieRegional(unknown, regionalRequest())
  expect(result.Rows[0].Cells[2].Quantity).toBe('9.00000001'); expect(result.Rows[0].Cells[3].Quantity).toBeNull()
})

it.each(['period', 'parent-quantity', 'child-count', 'child-unit', 'missing-total', 'unknown-as-zero', 'duplicate', 'missing-core'])
('rejects a result that cannot represent the requested current form: %s', fault => {
  const result = regionalResult()
  if (fault === 'period') result.To = '2026-10-30'
  if (fault === 'parent-quantity') result.Rows[0].Cells[2].Quantity = '9.00000002'
  if (fault === 'child-count') result.Rows[0].Cells[3].FactCount = 2
  if (fault === 'child-unit') result.Rows[0].Cells[3].UnitId = '13'
  if (fault === 'missing-total') result.Rows[0].Cells.splice(2, 1)
  if (fault === 'unknown-as-zero') result.Rows[0].Cells[3] = {
    Column: 'CounterpartyUnknown', RegionCode: null, Quantity: '0', UnitId: '12', FactCount: 3,
  }
  if (fault === 'duplicate') result.Rows[0].Cells.push(result.Rows[0].Cells[3])
  if (fault === 'missing-core') result.Rows[0].Cells.shift()
  expect(() => normalizeCurrentVparivanieRegional(result, regionalRequest())).toThrow('неповну')
})

it('retains complete-empty core zeros without invented facts and allows a complete empty group', () => {
  const result = regionalResult(); result.StockFacts = result.SaleFacts = result.ReturnFacts = result.CounterpartyFacts = 0
  result.Rows[0].Cells = [{ Column: 'Stock', RegionCode: null, Quantity: '0', UnitId: '12', FactCount: 0 },
    { Column: 'Sales', RegionCode: null, Quantity: '0', UnitId: '12', FactCount: 0 }]
  expect(normalizeCurrentVparivanieRegional(result, regionalRequest()).Rows[0].Cells[0].Quantity).toBe('0')
  result.Rows = []; result.ProductCount = 0
  expect(normalizeCurrentVparivanieRegional(result, regionalRequest()).Rows).toEqual([])
})
