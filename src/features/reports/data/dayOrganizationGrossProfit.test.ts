import { expect, it } from 'vitest'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { dayOrganizationGrossProfitConfigurationError } from './dayOrganizationGrossProfit'
import { nativeReportMeasurementUnit, usesNativeReportLookup } from './nativeReportProfiles'
import type { ReportDataset } from '../types'

const dataset: ReportDataset = {
  DataSource: 35, Name: 'Валовий прибуток GBA за днем та організацією', Description: 'Один період продажів',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: [{ Type: 3, Name: 'День' }, { Type: 4, Name: 'Організація' }],
  Measurements: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [0, 1, 2, 6, 9].map(Type => ({ Type, Name: `Фільтр ${Type}` })),
  productClassification: { Version: 1, SourceWorld: 0, RequiresIsService: true, RequiresProductKindId: true,
    ProductKindIdFormat: '32 hexadecimal characters (16 bytes)' },
  sourceOrganizations: { Version: 1, SourceWorlds: ['fenix'], MaximumOrganizationIds: 64,
    OrganizationIdFormat: '32 hexadecimal characters (16 bytes)', RequiresDurableNativeBinding: true,
    RequiresCompleteFactLineage: true },
  sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: '8AB2005056C0000811DEFC4535BB4D40',
    RequiresCompletePeriodLineage: true, UsesCurrentCapturedHierarchy: true },
  Limitations: ['Відповідність XLS 1С не підтверджена.'],
}

it('starts with ten day and organization measures and a bounded native preset', () => {
  const request = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-23')
  expect(request.sorted.Row.map(item => item.type)).toEqual([3, 4])
  expect(request.sorted.Measurements.map(item => item.Type)).toEqual([2, 3, 4, 6, 7, 8, 10, 12, 14, 15])
  expect(datasetConfigurationError(request, dataset)).toBeNull()
  expect(usesNativeReportLookup(35)).toBe(true)
  expect(nativeReportMeasurementUnit(35, 'Рентабельність з ПДВ, %')).toBe('Відсотки')
  expect(datasetPresetRequest(dataset, 'recorded-sale-gross-profit-by-day-organization', request)?.Data.dataSource).toBe(35)
})

it('accepts exact Fenix kind and service only with the advertised capability', () => {
  const request = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-23')
  request.productClassification = { Version: 1, SourceWorld: 0,
    ProductKindId: '8AB2005056C0000811DEF956DA4CFDA0', IsService: false }
  expect(datasetConfigurationError(request, dataset)).toBeNull()
  expect(datasetConfigurationError(request, { ...dataset, productClassification: undefined })).toContain('Сервер')
  expect(datasetConfigurationError({ ...request, productClassification: {
    ...(request.productClassification as object), IsService: null } }, dataset)).toContain('Некоректний')
  const withOrganizations = { ...request, sourceOrganizations: {
    Version: 1, SourceWorld: 'fenix', OrganizationIds: ['00000000000000000000000000000001'] } }
  expect(datasetConfigurationError(withOrganizations, dataset)).toBeNull()
  expect(datasetConfigurationError(withOrganizations, { ...dataset, sourceOrganizations: undefined })).toContain('Сервер')
  const withBuyers = { ...request, sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix',
    BuyerRootId: '8AB2005056C0000811DEFC4535BB4D40' } }
  expect(datasetConfigurationError(withBuyers, dataset)).toBeNull()
  expect(datasetConfigurationError(withBuyers, { ...dataset, sourceBuyerSubtree: undefined })).toContain('Сервер')
})

it('refuses hidden unsupported filters, ambiguous identifiers, foreign settings and changed server shape', () => {
  const request = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-23')
  request.selections = [{ IsChecked: true, SelectedField: { Type: 0, Name: 'Organization' },
    FilterCondition: { Type: 0, Name: 'Equals' }, Values: [{ Data: { Id: '9223372036854775807' }, Name: 'org', Value: 0 }] }]
  expect(dayOrganizationGrossProfitConfigurationError(request, dataset)).toBeNull()
  expect(dayOrganizationGrossProfitConfigurationError({ ...request, filterExpression: {} })).not.toBeNull()
  expect(dayOrganizationGrossProfitConfigurationError({ ...request, from: '2026-08-01' })).toContain('31')
  expect(dayOrganizationGrossProfitConfigurationError({ ...request, selections: [{ ...request.selections[0], IsChecked: false,
    SelectedField: { Type: 17, Name: 'Supplier' } }] })).not.toBeNull()
  expect(dayOrganizationGrossProfitConfigurationError({ ...request, selections: [{ ...request.selections[0],
    IsChecked: 'false' as unknown as boolean }] })).not.toBeNull()
  expect(dayOrganizationGrossProfitConfigurationError({ ...request, selections: [{ ...request.selections[0],
    Values: [{ ...request.selections[0].Values[0], Value: 2147483648 }] }] })).not.toBeNull()
  expect(dayOrganizationGrossProfitConfigurationError({ ...request, selections: [{ ...request.selections[0],
    Values: [{ Data: { Id: Number('9223372036854775807') }, Name: 'rounded', Value: 0 }] }] })).not.toBeNull()
  expect(dayOrganizationGrossProfitConfigurationError(request, { ...dataset, Filters: [] })).not.toBeNull()
})
