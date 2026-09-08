import { describe, expect, it } from 'vitest'
import { importedPaymentsDataset, importedPaymentsRequest } from './importedPayments.test-fixtures'
import { IMPORTED_PAYMENTS_GROUPS } from './importedPayments'
import { datasetConfigurationError, datasetFilters, datasetGroupings, datasetPresetRequest, datasetPresets } from './reportDatasets'
import { usesNativeReportLookup } from './nativeReportProfiles'

describe('source14 constructor contract', () => {
  it('selects currency/direction/account and three own-currency document measures with native lookups', () => {
    const data = importedPaymentsRequest()
    expect(data.sorted.Row.map(item => item.type)).toEqual([41, 48, 40]); expect(data.sorted.Col).toEqual([])
    expect(data.sorted.Measurements.map(item => item.Type)).toEqual([29, 30, 31])
    expect(datasetConfigurationError(data, importedPaymentsDataset)).toBeNull(); expect(usesNativeReportLookup(14)).toBe(true)
    expect(datasetGroupings(importedPaymentsDataset).find(item => item.type === 47)?.key).toBe('ImportedPaymentRecord')
    expect(datasetFilters(importedPaymentsDataset).find(item => item.field.Type === 38)?.field.Name).toBe('PaymentImportWorld')
  })
  it.each(Array.from({ length: 7 }, (_, index) => index + 1))('accepts selected measure mask %i', mask => {
    const data = importedPaymentsRequest(); data.sorted.Measurements = data.sorted.Measurements.filter((_, index) => mask & (1 << index))
    expect(datasetConfigurationError(data, importedPaymentsDataset)).toBeNull()
  })
  it.each(IMPORTED_PAYMENTS_GROUPS)('accepts advertised row and column group %i', type => {
    const data = importedPaymentsRequest(), group = datasetGroupings(importedPaymentsDataset).find(item => item.type === type)!
    data.sorted.Row = [group]; data.sorted.Col = [group]
    expect(datasetConfigurationError(data, importedPaymentsDataset)).toBeNull()
  })
  it.each(['comparison', 'Comparison', 'hideZero', 'HideZero', 'topGroups', 'TopGroups', 'threshold', 'Threshold', 'abcClassification', 'AbcClassification', 'valuationClientAgreementId'])('rejects unsupported %s before applying a template', key => {
    expect(datasetConfigurationError({ ...importedPaymentsRequest(), [key]: { Version: 1 } }, importedPaymentsDataset)).toBeTruthy()
  })
  it.each([['', '2026-07-31'], ['2026-02-30', '2026-07-31'], ['2026-08-01', '2026-07-31'], ['1899-12-31', '2026-07-31'], ['2026-07-01', '9999-01-01']])('rejects invalid date pair %s / %s', (from, to) => {
    expect(datasetConfigurationError({ ...importedPaymentsRequest(), from, to }, importedPaymentsDataset)).toBeTruthy()
  })
  it('retains exact different agreements sharing one terms ID in the preset, with calendar and filter expressions intact', () => {
    const data = importedPaymentsRequest()
    data.selections = [455430, 456506].map(Id => ({ IsChecked: true, SelectedField: { Type: 9, Name: 'CustomerContract' }, FilterCondition: { Type: 0, Name: 'Equals' }, Values: [{ Data: { Id, AgreementId: 802 }, Name: `Договір [${Id}]`, Value: Id }] }))
    const preset = datasetPresetRequest(importedPaymentsDataset, datasetPresets(importedPaymentsDataset)[0].id, data)!
    expect(preset.Data.selections).toEqual(data.selections); expect(preset.Data.from).toBe(data.from); expect(preset.Data.to).toBe(data.to)
  })
  it('rejects absent/duplicate axes, unsupported measure and empty selected subset', () => {
    for (const scenario of ['no-row', 'duplicate-row', 'duplicate-measure', 'wrong-measure', 'empty']) {
      const data = importedPaymentsRequest()
      if (scenario === 'no-row') data.sorted.Row = []
      if (scenario === 'duplicate-row') data.sorted.Row.push(data.sorted.Row[0])
      if (scenario === 'duplicate-measure') data.sorted.Measurements.push(data.sorted.Measurements[0])
      if (scenario === 'wrong-measure') data.sorted.Measurements[0].Type = 25
      if (scenario === 'empty') data.sorted.Measurements = []
      expect(datasetConfigurationError(data, importedPaymentsDataset)).toBeTruthy()
    }
  })
})
