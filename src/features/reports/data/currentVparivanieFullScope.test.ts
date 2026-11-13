import { expect, it } from 'vitest'
import { currentVparivanieConfigurationError, currentVparivanieFullScopeAvailable,
  CURRENT_VPARIVANIE_FULL_NOTE } from './currentVparivanie'
import { currentVparivanieDataset, currentVparivanieRequest, currentVparivaniePreview, exactSelection } from './currentVparivanie.test-fixtures'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { normalizeCurrentVparivanieRegional } from './currentVparivanieRegional'
import { regionalRequest, regionalResult } from './currentVparivanieRegional.test-fixtures'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { currentRegionalSheets } from './currentVparivanieRegionalExport'

const dataset = { ...currentVparivanieDataset, currentVparivanie: { ...(currentVparivanieDataset.currentVparivanie as object),
  FullScopeVersion: 1, FullScopeContract: 'OneOurSnapshotCompleteSelectedScope', FullScopeMaximumRows: 500000,
  FullScopeMaximumSelectedProducts: 4096, FullScopeMaximumColumns: 256, FullScopeMaximumAddressedCells: 1000000 } }

it('negotiates the complete selection independently from the retained bounded capability', () => {
  expect(currentVparivanieFullScopeAvailable(currentVparivanieDataset)).toBe(false)
  expect(currentVparivanieFullScopeAvailable(dataset)).toBe(true)
  const request = { ...currentVparivanieRequest(), currentVparivanieFullScope: true,
    selections: [exactSelection(1, 2, Array.from({ length: 257 }, (_, i) => String(i + 1)))] }
  expect(currentVparivanieConfigurationError(request, dataset)).toBeNull()
  expect(currentVparivanieConfigurationError(request, currentVparivanieDataset)).toContain('не підтримує')
  expect(currentVparivanieConfigurationError({ ...request, currentVparivanieFullScope: undefined }, dataset)).not.toBeNull()
})

it.each([false, null, 'true', 1])('refuses a noncanonical full scope mode %s', value => {
  expect(currentVparivanieConfigurationError({ ...currentVparivanieRequest(), currentVparivanieFullScope: value }, dataset)).not.toBeNull()
})

it('refuses duplicate or foreign mode and allows deliberately clearing a saved full mode', () => {
  const request = { ...currentVparivanieRequest(), currentVparivanieFullScope: true }
  expect(currentVparivanieConfigurationError({ ...request, CurrentVparivanieFullScope: true }, dataset)).not.toBeNull()
  expect(currentVparivanieConfigurationError({ ...request, dataSource: 2 })).not.toBeNull()
  expect(retainStoredTemplateFields(request, currentVparivanieRequest()).currentVparivanieFullScope).toBeUndefined()
})

it('requires the full preview version and complete note before accepting more than 128 products', () => {
  const preview = currentVparivaniePreview()
  preview.CurrentVparivanieProducts.Version = 2
  preview.Page.TotalVisibleRows = 257; preview.Page.HasMore = true
  preview.Request.Notes.push(CURRENT_VPARIVANIE_FULL_NOTE)
  const result = normalizeNativeReportPreview({ Preview: preview }, true)
  expect(result.CurrentVparivanieProducts?.Version).toBe(2)
  expect(result.Page.TotalVisibleRows).toBe(257)
  expect(result.CurrentVparivanieProducts?.Rows[0].Article).toBe('0000123')
  expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow('непідтверджені')
  preview.CurrentVparivanieProducts.Version = 1
  expect(() => normalizeNativeReportPreview({ Preview: preview }, true)).toThrow('непідтверджені')
})

it('keeps preview and full export footprint resource refusal explicit', () => {
  const preview = currentVparivaniePreview(); preview.CurrentVparivanieProducts.Version = 2
  preview.Request.Notes.push(CURRENT_VPARIVANIE_FULL_NOTE)
  preview.Page.TotalVisibleRows = 500000; preview.Page.HasMore = true
  expect(() => normalizeNativeReportPreview({ Preview: preview }, true)).toThrow('непідтверджені')
})

it('requires the own complete regional marker while keeping current version 3 and exact quantities', () => {
  const request = { ...regionalRequest(), currentVparivanieFullScope: true }
  const result = { ...regionalResult(), FullScopeVersion: 1 }
  result.Request.Notes.push(CURRENT_VPARIVANIE_FULL_NOTE)
  expect(normalizeCurrentVparivanieRegional(result, request).Rows[0].Cells[0].Quantity).toBe('9007199254740993.00000001')
  expect(() => normalizeCurrentVparivanieRegional(result, regionalRequest())).toThrow('неповну')
  expect(() => normalizeCurrentVparivanieRegional(regionalResult(), request)).toThrow('неповну')
})

it('counts the seven attributes and financial keys in the complete regional Matrix footprint', () => {
  const request = { ...regionalRequest(), currentVparivanieFullScope: true }
  const result = { ...regionalResult(), FullScopeVersion: 1 as const,
    ProductCount: 3802, StockFacts: 0, SaleFacts: 253, ReturnFacts: 0, CounterpartyFacts: 253 }
  result.Request.Notes.push(CURRENT_VPARIVANIE_FULL_NOTE)
  const empty = [
    { Column: 'Stock' as const, RegionCode: null, Quantity: '0', UnitId: '12', FactCount: 0 },
    { Column: 'Sales' as const, RegionCode: null, Quantity: '0', UnitId: '12', FactCount: 0 },
  ]
  result.Rows = Array.from({ length: 3802 }, (_, i) => ({ ...regionalResult().Rows[0], ProductId: String(i + 1), Cells: empty }))
  result.Rows[0].Cells = [empty[0], { ...empty[1], Quantity: '1012', FactCount: 253 },
    { Column: 'CounterpartyTotal', RegionCode: null, Quantity: '1012', UnitId: '12', FactCount: 253 },
    ...Array.from({ length: 252 }, (_, i) => ({ Column: 'CounterpartyRegionCode' as const,
      RegionCode: `R${i + 1}`, Quantity: '4', UnitId: '12', FactCount: 1 })),
    { Column: 'CounterpartyUnknown', RegionCode: null, Quantity: null, UnitId: null, FactCount: 1 }]
  const accepted = normalizeCurrentVparivanieRegional(result, request)
  expect(currentRegionalSheets(accepted).matrix[3]).toHaveLength(263)
  result.Rows.push({ ...regionalResult().Rows[0], ProductId: '3803', Cells: empty })
  result.ProductCount = 3803
  expect(() => normalizeCurrentVparivanieRegional(result, request)).toThrow('неповну')
})

it('admits the complete sparse Matrix without inventing an absent counterparty column', () => {
  const request = { ...regionalRequest(), currentVparivanieFullScope: true }
  const result = { ...regionalResult(), FullScopeVersion: 1 as const,
    ProductCount: 100000, StockFacts: 100000, SaleFacts: 0, ReturnFacts: 0, CounterpartyFacts: 0 }
  result.Request.Notes.push(CURRENT_VPARIVANIE_FULL_NOTE)
  const cells = [
    { Column: 'Stock' as const, RegionCode: null, Quantity: '1', UnitId: '12', FactCount: 1 },
    { Column: 'Sales' as const, RegionCode: null, Quantity: '0', UnitId: '12', FactCount: 0 },
  ]
  const product = regionalResult().Rows[0]
  result.Rows = Array.from({ length: 100000 }, (_, i) => ({ ...product, ProductId: String(i + 1), Cells: cells }))
  const accepted = normalizeCurrentVparivanieRegional(result, request)
  expect(accepted.ProductCount).toBe(100000)
  expect(accepted.Rows[99999].Cells.map(value => value.Column)).toEqual(['Stock', 'Sales'])
})
