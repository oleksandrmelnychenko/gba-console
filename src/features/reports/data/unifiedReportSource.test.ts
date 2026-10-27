import { expect, it } from 'vitest'
import { carriesSourceWorld, UNIFIED_SOURCE_SAVED_VARIANT_ERROR, withUnifiedSource } from './unifiedReportSource'
import { defaultDatasetRequest } from './reportDatasets'
import { profitDayDataset, profitSupplierDataset } from './profitReadMode.test-fixtures'
import { cashModeDataset } from './cashReadMode.test-fixtures'
import { settlementModeDataset } from './settlementReadMode.test-fixtures'
import { savedNativeReportConfigurationError } from './savedNativeReport'
import { FENIX_BUYERS_ROOT_ID } from './nativeExactFilters'
import { DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from './dayOrganizationGrossProfit'

const SERVICE_KIND_ID = '8FC4005056C0000811DF10AE5525F8C8'

const goods = { Version: 1, SourceWorld: 0, ProductKindId: '8AB2005056C0000811DEF956DA4CFDA0', IsService: false }

it('drops the supplier base and reads 1C-register profit variants from GBA documents', () => {
  const defaults = defaultDatasetRequest(profitSupplierDataset, '2026-09-01', '2026-09-30')
  delete defaults.profitReadMode
  const request = { ...defaults, SupplierSourceWorld: 0, ProfitReadMode: 1 }
  expect(carriesSourceWorld(request)).toBe(true)
  const unified = withUnifiedSource(request, profitSupplierDataset)
  expect(Object.keys(unified).filter(key => key.toLowerCase() === 'suppliersourceworld')).toEqual([])
  expect(Object.keys(unified).filter(key => key.toLowerCase() === 'profitreadmode')).toEqual(['profitReadMode'])
  expect(unified.profitReadMode).toBe(0)
  expect(carriesSourceWorld(unified)).toBe(false)
  expect(request.SupplierSourceWorld).toBe(0)
})

it('maps the Fenix goods classification of day gross profit onto the GBA goods filter and keeps the buyer filter', () => {
  const serviceDataset = { ...profitDayDataset, productServiceFilter: { Version: 1, IsServiceValues: [false, true],
    GoodsKind: 'Товар', Basis: 'GbaProductClassification' } }
  const request = { ...defaultDatasetRequest(serviceDataset, '2026-09-01', '2026-09-30'), productClassification: goods,
    sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID } }
  expect(carriesSourceWorld(request)).toBe(false)
  const unified = withUnifiedSource(request, serviceDataset)
  expect(unified).not.toHaveProperty('productClassification')
  expect(unified.productServiceFilter).toEqual({ Version: 1, IsService: false })
  expect(unified.sourceBuyerSubtree).toEqual(request.sourceBuyerSubtree)
  expect(unified.profitReadMode).toBe(0)
  const serviceKindServices = { ...goods, ProductKindId: SERVICE_KIND_ID, IsService: true }
  const services = withUnifiedSource({ ...request, productClassification: serviceKindServices }, serviceDataset)
  expect(services.productClassification).toEqual(serviceKindServices)
  expect(services).not.toHaveProperty('productServiceFilter')
  const goodsKindServices = { ...goods, IsService: true }
  expect(withUnifiedSource({ ...request, productClassification: goodsKindServices }, serviceDataset).productClassification).toEqual(goodsKindServices)
  expect(withUnifiedSource(request, profitDayDataset).productClassification).toEqual(goods)
})

it('defaults an unmarked operational profit variant to GBA documents', () => {
  const request = defaultDatasetRequest(profitSupplierDataset, '2026-09-01', '2026-09-30')
  delete request.profitReadMode
  expect(withUnifiedSource(request, profitSupplierDataset).profitReadMode).toBe(0)
})

it('reads a 1C-register cash variant from GBA documents', () => {
  const request = { ...defaultDatasetRequest(cashModeDataset, '2026-09-01', '2026-09-30'), cashReadMode: 1 }
  expect(carriesSourceWorld(request)).toBe(true)
  expect(withUnifiedSource(request, cashModeDataset).cashReadMode).toBe(0)
})

it('turns AMG and 1C-register settlement variants into the unified GBA-documents request', () => {
  const base = defaultDatasetRequest(settlementModeDataset, '2026-09-01', '2026-09-30')
  delete base.sourceBuyerSubtree
  const amg = { ...base, groupedSettlementPeriod: { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' } }
  delete amg.settlementReadMode
  expect(carriesSourceWorld(amg)).toBe(true)
  const unified = withUnifiedSource(amg, settlementModeDataset)
  expect(unified.groupedSettlementPeriod).toEqual({ Version: 1, SourceWorld: 'Fenix', CurrencyBasis: 'SettlementCurrency' })
  expect(unified.sourceBuyerSubtree).toMatchObject({ Version: 1, SourceWorld: 'fenix' })
  expect(unified.settlementReadMode).toBe(0)
  const settlement = defaultDatasetRequest(settlementModeDataset, '2026-09-01', '2026-09-30')
  delete settlement.settlementReadMode
  const registers = withUnifiedSource({ ...settlement, SettlementReadMode: 1 }, settlementModeDataset)
  expect(Object.keys(registers).filter(key => key.toLowerCase() === 'settlementreadmode').map(key => (registers as unknown as Record<string, unknown>)[key])).toEqual([0])
})

it('refuses to run a saved variant that still carries a Fenix/AMG base without opening it first', () => {
  const data = { ...defaultDatasetRequest(profitSupplierDataset, '2026-09-01', '2026-09-30'), supplierSourceWorld: 0 }
  expect(savedNativeReportConfigurationError({ Id: '10000000-0000-4000-8000-000000000001', Revision: 1, Name: 'Saved', Data: data },
    [profitSupplierDataset])).toBe(UNIFIED_SOURCE_SAVED_VARIANT_ERROR)
})

it('reads the day workbook organizations of the 1C list as every GBA organization and keeps any other list for review', () => {
  const book = { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS.map(id => id.toLowerCase()),
    DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS[0]] }
  const request = { ...defaultDatasetRequest(profitDayDataset, '2026-09-01', '2026-09-30'), SourceOrganizations: book }
  const unified = withUnifiedSource(request, profitDayDataset)
  expect(Object.keys(unified).filter(key => key.toLowerCase() === 'sourceorganizations')).toEqual([])
  expect(request.SourceOrganizations).toBe(book)
  const fenixOnly = { ...request, SourceOrganizations: { ...book, OrganizationIds: [DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS[1]] } }
  expect(withUnifiedSource(fenixOnly, profitDayDataset).SourceOrganizations).toEqual(fenixOnly.SourceOrganizations)
  const registers = { ...request, profitReadMode: 1 }
  const kept = withUnifiedSource(registers, { ...profitDayDataset, profitReadMode: undefined })
  expect(kept.SourceOrganizations).toEqual(book)
})
