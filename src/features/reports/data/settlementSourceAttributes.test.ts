import { expect, it } from 'vitest'
import { groupedSettlementCapability, groupedSettlementConfigurationError, settlementFormDataset } from './groupedSettlementPeriod'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { datasetFilters } from './reportDatasets'
import { settlementAttributeKey, settlementAttributeText, readSettlementCounterpartyAttributes } from './settlementSourceAttributes'
import { settlementAttributesDataset, settlementAttributesRequest, settlementAttributePreview, knownSettlementAttribute } from './settlementSourceAttributes.test-fixtures'
const attribute = (field: number, key: string) => ({ IsChecked: true, SelectedField: { Type: field, Name: 'Source attribute' },
  FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: key, Name: 'Selected label' }, Name: 'Selected label', Value: 0 }] })
it('advertises only the proven Fenix attributes while retaining the two financial row layouts', () => {
  const cap = groupedSettlementCapability(settlementAttributesDataset.groupedSettlementPeriod)!
  expect(cap.SourceAttributeWorlds).toEqual(['Fenix']); expect(cap.RowLayouts).toEqual([[4, 41, 76], [4, 76]])
  expect(datasetFilters(settlementFormDataset(settlementAttributesDataset, settlementAttributesRequest().groupedSettlementPeriod)).map(x => x.field.Type)).toEqual([0, 6, 9, 17, 18, 30, 60, 61])
  expect(datasetFilters(settlementFormDataset(settlementAttributesDataset, { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' })).map(x => x.field.Type)).toEqual([0, 6, 9, 17, 18, 30])
})
it('preserves exact source manager and region keys without accepting a local numeric substitution', () => {
  const request = settlementAttributesRequest()
  request.selections = [attribute(60, 'A'.repeat(32)), attribute(61, 'region:0042')]
  expect(groupedSettlementConfigurationError(request, settlementAttributesDataset, '2026-10-03')).toBeNull()
  request.selections[0] = attribute(60, '1')
  expect(groupedSettlementConfigurationError(request, settlementAttributesDataset, '2026-10-03')).not.toBeNull()
})
it('does not silently remap a saved Fenix source filter when its world changes to AMG', () => {
  const request = settlementAttributesRequest()
  request.groupedSettlementPeriod = { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' }
  request.sourceBuyerSubtree = undefined; request.selections = [attribute(61, 'region:0042')]
  expect(groupedSettlementConfigurationError(request, settlementAttributesDataset, '2026-10-03')).not.toBeNull()
  expect(request.selections[0].Values[0].Data).toEqual({ Id: 'region:0042', Name: 'Selected label' })
})
it('refuses an incomplete or invented attribute-world capability', () => {
  const base = settlementAttributesDataset.groupedSettlementPeriod as Record<string, unknown>
  expect(groupedSettlementCapability({ ...base, SourceAttributeWorlds: ['Fenix', 'Amg'] })).toBeNull()
  const missing = { ...base }; Reflect.deleteProperty(missing, 'AdditionalFields')
  expect(groupedSettlementCapability(missing)).toBeNull()
})
it('preserves source NULL and empty region text as distinct from unavailable', () => {
  expect(settlementAttributeKey(61, { Id: 'region:null' })).not.toBe(settlementAttributeKey(61, { Id: 'region:' }))
  const known = knownSettlementAttribute()
  expect(settlementAttributeText({ ...known, RegionCode: null }, 'region')).toBe('∅')
  expect(settlementAttributeText({ ...known, RegionCode: '' }, 'region')).toBe('')
  expect(settlementAttributeText({ ...known, RegionCode: null, RegionAvailable: false }, 'region')).toBe('—')
})
it('binds each additional field to its actual visible row and current result hash', () => {
  const preview = settlementAttributePreview()
  const parsed = normalizeNativeReportPreview({ Preview: preview })
  expect(parsed.SettlementCounterpartyAttributes?.Rows[0]).toEqual(knownSettlementAttribute())
  preview.SettlementCounterpartyAttributes.ResultSha256 = 'c'.repeat(64)
  expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow(/прив’язка/)
})
it('refuses reordered, duplicated or missing attribute rows instead of attaching them to another buyer', () => {
  const display = settlementAttributePreview().SettlementCounterpartyAttributes
  expect(() => readSettlementCounterpartyAttributes(display, 'a'.repeat(64), [13])).toThrow()
  expect(() => readSettlementCounterpartyAttributes({ ...display, Rows: [display.Rows[0], display.Rows[0]] }, 'a'.repeat(64), [12])).toThrow()
})
it('refuses contradictory known manager and unavailable region payloads', () => {
  const display = settlementAttributePreview().SettlementCounterpartyAttributes
  expect(() => readSettlementCounterpartyAttributes({ ...display, Rows: [{ ...knownSettlementAttribute(), ManagerAssigned: false }] }, 'a'.repeat(64), [12])).toThrow()
  expect(() => readSettlementCounterpartyAttributes({ ...display, Rows: [{ ...knownSettlementAttribute(), RegionAvailable: false }] }, 'a'.repeat(64), [12])).toThrow()
})
it('keeps known-unassigned manager distinct from an unknown legacy observation', () => {
  const known = { ...knownSettlementAttribute(), ManagerName: null, ManagerAssigned: false }
  expect(settlementAttributeText(known, 'manager')).toBe('∅')
  expect(settlementAttributeText({ ...known, ManagerAvailable: false, ManagerAssigned: null }, 'manager')).toBe('—')
})
it('refuses additional settlement fields attached to another report dataset', () => {
  const preview = settlementAttributePreview(); preview.Request.DataSource = 'NativeCashPeriod'
  expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow(/набору/)
})
