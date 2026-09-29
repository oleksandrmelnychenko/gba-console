import { expect, it } from 'vitest'
import { datasetConfigurationError, defaultDatasetRequest } from './reportDatasets'
import { nativeReportMeasurementUnit, usesNativeReportLookup } from './nativeReportProfiles'
import { supplierBatchGrossProfitConfigurationError } from './supplierBatchGrossProfit'
import { FENIX_BUYERS_ROOT_ID, normalizeNativeExactFilterDataset, requestSourceBuyerSubtree } from './nativeExactFilters'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import type { ReportDataset } from '../types'

const dataset: ReportDataset = {
  DataSource: 38, Name: 'Валовий прибуток GBA за постачальниками (партії)', Description: 'Партії продажів',
  PeriodRequired: true, PeriodSupported: true,
  supplierSourceWorld: { Version: 1, SourceWorlds: [0, 1], RequiresCompletePeriodLineage: true },
  sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID,
    RequiresCompletePeriodLineage: true, UsesCurrentCapturedHierarchy: true },
  Groupings: [73, 4, 21].map(Type => ({ Type, Name: `Вимір ${Type}` })),
  Measurements: [0, 2, 3, 4, 6, 7, 8, 10, 12, 14].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [0, 17].map(Type => ({ Type, Name: `Фільтр ${Type}` })), Limitations: [],
}

it('starts with the six XLS measures and exact source warehouse grouping', () => {
  const request = defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31')
  expect(request.sorted.Row.map(item => item.type)).toEqual([73, 4, 21])
  expect(request.sorted.Measurements.map(item => item.Type)).toEqual([0, 2, 6, 10, 12, 14])
  expect(request.supplierSourceWorld).toBe(0)
  expect(datasetConfigurationError(request, dataset)).toBeNull()
  expect(usesNativeReportLookup(38)).toBe(true)
  expect(nativeReportMeasurementUnit(38, 'Кількість')).toBe('Кількість товару')
  expect(nativeReportMeasurementUnit(38, 'Продана кількість GBA')).toBe('Кількість товару')
  expect(nativeReportMeasurementUnit(38, 'Рентабельність без ПДВ, %')).toBe('Відсотки')
})

it('rejects unrelated filters, rounded IDs and an overly long period', () => {
  const request = defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31')
  expect(supplierBatchGrossProfitConfigurationError({ ...request, from: '2026-06-01' })).toContain('31')
  expect(supplierBatchGrossProfitConfigurationError({ ...request, filterExpression: {} })).not.toBeNull()
  request.selections = [{ IsChecked: true, SelectedField: { Type: 17, Name: 'Supplier' },
    FilterCondition: { Type: 0, Name: 'Equals' }, Values: [{ Data: { Id: '9223372036854775807' }, Name: 'supplier', Value: 0 }] }]
  expect(supplierBatchGrossProfitConfigurationError(request, dataset)).toBeNull()
  expect(supplierBatchGrossProfitConfigurationError({ ...request, selections: [{ ...request.selections[0],
    Values: [{ Data: { Id: Number('9223372036854775807') }, Name: 'rounded', Value: 0 }] }] })).not.toBeNull()
  expect(supplierBatchGrossProfitConfigurationError(request, { ...dataset, Groupings: [] })).not.toBeNull()
  expect(supplierBatchGrossProfitConfigurationError({ ...request, supplierSourceWorld: 2 }, dataset)).not.toBeNull()
  expect(supplierBatchGrossProfitConfigurationError(request, { ...dataset, supplierSourceWorld: undefined })).not.toBeNull()
  expect(supplierBatchGrossProfitConfigurationError({ ...request, SupplierSourceWorld: 1 }, dataset)).not.toBeNull()
  expect(datasetConfigurationError({ ...request, dataSource: 35 }, { ...dataset, DataSource: 35 })).not.toBeNull()
})

it('restores the exact source world from a server saved template', () => {
  const request = defaultDatasetRequest(dataset, '2026-09-05', '2026-09-05')
  const template = normalizeSavedTemplate({ Id: '10000000-0000-4000-8000-000000000038',
    Revision: 1, Name: 'Fenix', Data: { DataSource: 38, From: request.from, To: request.to,
      Sorted: request.sorted, Selections: request.selections, SupplierSourceWorld: 0 } } as never)
  expect(template.Data.supplierSourceWorld).toBe(0)
  expect(datasetConfigurationError(template.Data, dataset)).toBeNull()
})

it('uses the exact Fenix Buyers subtree only with Fenix and a matching server capability', () => {
  const request = defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31')
  request.sourceBuyerSubtree = { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID }
  expect(datasetConfigurationError(request, dataset)).toBeNull()
  expect(datasetConfigurationError({ ...request, supplierSourceWorld: 1 }, dataset)).toContain('Fenix')
  expect(datasetConfigurationError({ ...request, supplierSourceWorld: undefined }, dataset)).toContain('Fenix')
  expect(datasetConfigurationError(request, { ...dataset, sourceBuyerSubtree: undefined })).not.toBeNull()
  expect(datasetConfigurationError({ ...request, sourceBuyerSubtree: undefined },
    { ...dataset, sourceBuyerSubtree: undefined })).toBeNull()
  expect(normalizeNativeExactFilterDataset({ ...dataset, sourceBuyerSubtree: undefined })).not.toBeNull()
  expect(datasetConfigurationError({ ...request, sourceBuyerSubtree: {
    Version: 1, SourceWorld: 'fenix', BuyerRootId: '00000000000000000000000000000001',
  } }, dataset)).not.toBeNull()
  const template = normalizeSavedTemplate({ Id: '10000000-0000-4000-8000-000000000038',
    Revision: 1, Name: 'Fenix Buyers', Data: { DataSource: 38, From: request.from, To: request.to,
      Sorted: request.sorted, Selections: request.selections, SupplierSourceWorld: 0,
      SourceBuyerSubtree: request.sourceBuyerSubtree } } as never)
  expect(requestSourceBuyerSubtree(template.Data)).toEqual(request.sourceBuyerSubtree)
  expect(datasetConfigurationError(template.Data, dataset)).toBeNull()
})
