import { expect, it } from 'vitest'
import { datasetConfigurationError, defaultDatasetRequest } from './reportDatasets'
import { nativeReportMeasurementUnit, usesNativeReportLookup } from './nativeReportProfiles'
import { vparivanieConfigurationError } from './vparivanie'
import type { ReportDataset } from '../types'

const dataset: ReportDataset = {
  DataSource: 36, Name: 'Впарювання GBA: підтверджені залишки й продажі', Description: 'Один товар',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: [{ Type: 5, Name: 'Товар' }],
  Measurements: [80, 81, 82].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [1, 5].map(Type => ({ Type, Name: `Фільтр ${Type}` })), Limitations: [],
}

it('requires an exact product and keeps the three certified measures in source order', () => {
  const request = defaultDatasetRequest(dataset, '2026-01-01', '2026-09-23')
  expect(request.sorted.Row.map(item => item.type)).toEqual([5])
  expect(request.sorted.Measurements.map(item => item.Type)).toEqual([80, 81, 82])
  expect(vparivanieConfigurationError(request, dataset)).not.toBeNull()
  request.selections = [{ IsChecked: true, SelectedField: { Type: 1, Name: 'Product' },
    FilterCondition: { Type: 0, Name: 'Equals' },
    Values: [{ Data: { Id: '9223372036854775807' }, Name: 'product', Value: 0 }] }]
  expect(datasetConfigurationError(request, dataset)).toBeNull()
  expect(usesNativeReportLookup(36)).toBe(true)
  expect(nativeReportMeasurementUnit(36, 'Продажи: кількість за період')).toBe('Кількість товару')
})

it('rejects another product, rounded IDs, excess period and unsupported saved settings', () => {
  const request = defaultDatasetRequest(dataset, '2026-01-01', '2026-09-23')
  request.selections = [{ IsChecked: true, SelectedField: { Type: 1, Name: 'Product' },
    FilterCondition: { Type: 0, Name: 'Equals' },
    Values: [{ Data: { Id: '9223372036854775807' }, Name: 'product', Value: 0 }] }]
  expect(vparivanieConfigurationError({ ...request, from: '2025-01-01' })).toContain('366')
  expect(vparivanieConfigurationError({ ...request, filterExpression: {} })).not.toBeNull()
  expect(vparivanieConfigurationError({ ...request, selections: [{ ...request.selections[0],
    Values: [{ Data: { Id: Number('9223372036854775807') }, Name: 'rounded', Value: 0 }] }] })).not.toBeNull()
  expect(vparivanieConfigurationError({ ...request, selections: [...request.selections, request.selections[0]] })).not.toBeNull()
  expect(vparivanieConfigurationError(request, { ...dataset, Filters: [] })).not.toBeNull()
})
