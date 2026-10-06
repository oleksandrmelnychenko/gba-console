import { expect, it } from 'vitest'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { recordedSaleGrossProfitConfigurationError } from './recordedSaleGrossProfit'
import { nativeReportMeasurementUnit, usesNativeReportLookup } from './nativeReportProfiles'
import { grossDataset } from './recordedSaleGrossProfit.test-fixtures'

it('starts with one period, exact agreement grain and four measures', () => {
  const request = defaultDatasetRequest(grossDataset, '2026-09-01', '2026-09-23')
  expect(request.sorted.Row.map(item => item.type)).toEqual([12, 15])
  expect(request.sorted.Measurements.map(item => item.Type)).toEqual([2, 6, 10, 14])
  expect(datasetConfigurationError(request, grossDataset)).toBeNull()
  expect(usesNativeReportLookup(30)).toBe(true)
  expect(nativeReportMeasurementUnit(30, 'Рентабельність без ПДВ, %')).toBe('Відсотки')
  const preset = datasetPresetRequest(grossDataset, 'recorded-sale-gross-profit-by-agreement', request)!
  expect(preset.Data.from).toBe('2026-09-01'); expect(preset.Data.to).toBe('2026-09-23')
})

it('accepts a selected measure subset and exact product ID; refuses ambiguity and incompatible settings', () => {
  const request = defaultDatasetRequest(grossDataset, '2026-09-01', '2026-09-23')
  request.sorted.Measurements = request.sorted.Measurements.slice(0, 2)
  request.selections = [{ IsChecked: true, SelectedField: { Type: 1, Name: 'Product' },
    FilterCondition: { Type: 0, Name: 'Equals' }, Values: [{ Data: { Id: '9223372036854775807' }, Name: 'product', Value: 1 }] }]
  expect(recordedSaleGrossProfitConfigurationError(request, grossDataset)).toBeNull()
  expect(recordedSaleGrossProfitConfigurationError({ ...request, to: '2026-08-31' })).not.toBeNull()
  expect(recordedSaleGrossProfitConfigurationError({ ...request, from: '2026-08-22' })).toContain('31')
  expect(recordedSaleGrossProfitConfigurationError({ ...request, from: '0002-09-01' })).not.toBeNull()
  expect(recordedSaleGrossProfitConfigurationError({ ...request, rateComparison: {} })).not.toBeNull()
  expect(recordedSaleGrossProfitConfigurationError({ ...request, selections: [{ ...request.selections[0],
    Values: [{ Data: { Id: Number('9223372036854775807') }, Name: 'rounded', Value: 1 }] }] })).not.toBeNull()
  expect(recordedSaleGrossProfitConfigurationError({ ...request, sorted: { ...request.sorted,
    Row: [...request.sorted.Row].reverse() } })).not.toBeNull()
  expect(recordedSaleGrossProfitConfigurationError({ ...request, sorted: { ...request.sorted,
    Measurements: [] } })).not.toBeNull()
})
