import { expect, it } from 'vitest'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import type { ReportDataset } from '../types'
import { availableBug1274WorkbookLaunches } from './bug1274WorkbookLaunch'
import { normalizeNativeExactFilterDataset } from './nativeExactFilters'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { isSupplierBasisCapability, requestSupplierBasis } from './supplierBasis'

const capability = { Version: 1, DefaultBasis: 0, Bases: [0, 1], MaximumDays: 31,
  IncludesReturns: true, PreservesUnavailableValues: true, RegistrarWarehouseGrouping: 78 }
const dataset: ReportDataset = {
  DataSource: 38, Name: 'Прибуток за постачальниками', Description: 'Продажі та повернення',
  PeriodRequired: true, PeriodSupported: true, supplierBasis: capability,
  supplierSourceWorld: { Version: 1, SourceWorlds: [0, 1], RequiresCompletePeriodLineage: true },
  Groupings: [73, 78, 4, 21].map(Type => ({ Type, Name: `Група ${Type}` })),
  Measurements: [0, 2, 3, 4, 6, 7, 8, 10, 12, 14].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [0, 1, 17].map(Type => ({ Type, Name: `Фільтр ${Type}` })), Limitations: [],
}

it('admits the precise ordinary contract with either casing and rejects inconsistent server declarations', () => {
  const camel = Object.fromEntries(Object.entries(capability).map(([key, value]) =>
    [key[0].toLowerCase() + key.slice(1), value]))
  expect(isSupplierBasisCapability(camel)).toBe(true)
  const { supplierBasis: _basis, ...rest } = dataset
  void _basis
  expect(normalizeNativeExactFilterDataset({ ...rest, SupplierBasis: camel })?.supplierBasis).toEqual(camel)
  for (const changed of [null, { ...capability, IncludesReturns: false }, { ...capability, PreservesUnavailableValues: false },
    { ...capability, MaximumDays: 32 }, { ...capability, RegistrarWarehouseGrouping: 73 },
    { ...capability, version: 1 }, { ...capability, Bases: [1, 0] }]) {
    expect(normalizeNativeExactFilterDataset({ ...rest, SupplierBasis: changed })).toBeNull()
  }
  expect(normalizeNativeExactFilterDataset({ ...dataset, SupplierBasis: capability })).toBeNull()
  expect(normalizeNativeExactFilterDataset({ ...dataset, Groupings: dataset.Groupings.filter(field => field.Type !== 78) })).toBeNull()
  expect(normalizeNativeExactFilterDataset({ ...dataset, DataSource: 2 })).toBeNull()
})

it('opts fresh month requests into returns and registrar warehouse only on an advertised server', () => {
  const current = defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31')
  expect(current.supplierBasis).toBe(0)
  expect(current.sorted.Row.map(field => field.type)).toEqual([78, 4, 21])
  expect(current.sorted.Measurements.map(field => field.Type)).toEqual([0, 2, 6, 10, 12, 14])
  expect(datasetConfigurationError(current, dataset)).toBeNull()
  const old = defaultDatasetRequest({ ...dataset, supplierBasis: undefined }, current.from, current.to)
  expect(old).not.toHaveProperty('supplierBasis')
  expect(old.sorted.Row.map(field => field.type)).toEqual([73, 4, 21])
  const [launch] = availableBug1274WorkbookLaunches([dataset])
  expect(launch.notice).toContain('продажі мінус повернення')
  expect(launch.notice).toContain('зокрема у підсумках')
  expect(launch.notice).not.toMatch(/джерельн|доказ|захоплен|паритет/i)
})

it('refuses invalid basis, duplicate aliases, wrong datasets and receipt substitution', () => {
  const request = defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31')
  for (const basis of ['0', true, 2, -1, 0.5])
    expect(datasetConfigurationError({ ...request, supplierBasis: basis }, dataset)).toContain('Некоректний спосіб')
  expect(datasetConfigurationError({ ...request, supplierBasis: null, SupplierBasis: null }, dataset)).toContain('двічі')
  expect(datasetConfigurationError({ ...request, dataSource: 2 }, { ...dataset, DataSource: 2 })).toContain('лише')
  expect(datasetConfigurationError(request, { ...dataset, supplierBasis: undefined })).toContain('Сервер')
  const receipt = { ...request, sorted: { ...request.sorted, Row: [{ ...request.sorted.Row[0], type: 73 }, ...request.sorted.Row.slice(1)] } }
  expect(datasetConfigurationError(receipt, dataset)).toContain('склад документа')
  expect(datasetConfigurationError({ ...receipt, supplierBasis: 1 }, dataset)).toBeNull()
})

it.each([undefined, null, 1])('preserves saved basis %s through normalization, layout, request and update', basis => {
  const legacy = defaultDatasetRequest({ ...dataset, supplierBasis: undefined }, '2026-07-01', '2026-07-31')
  const saved = normalizeSavedTemplate({ Id: crypto.randomUUID(), Revision: 1, Name: 'Збережений прибуток',
    UpdatedAtUtc: '2026-07-31T00:00:00.000Z', Data: {
    DataSource: 38, From: legacy.from, To: legacy.to, Sorted: legacy.sorted, Selections: [],
    ...(basis === undefined ? {} : { SupplierBasis: basis }),
  } })
  expect(requestSupplierBasis(saved.Data)).toBe(basis)
  expect(saved.Data).not.toHaveProperty('supplierBasis')
  const preset = datasetPresetRequest(dataset, 'recorded-supplier-batch-gross-profit', saved.Data)!
  expect(preset).not.toBeNull()
  expect(requestSupplierBasis(preset.Data)).toBe(basis)
  expect(preset.Data.sorted.Row.map(field => field.type)).toEqual([73, 4, 21])
  const registrar = datasetPresetRequest(dataset, 'supplier-registrar-warehouse', saved.Data)!
  expect(requestSupplierBasis(registrar.Data)).toBe(basis)
  expect(registrar.Data.sorted.Row.map(field => field.type)).toEqual([78, 4, 21])
  const built = buildReportBuilderRequest({ dataSource: 38, from: legacy.from, to: legacy.to,
    ordering: undefined, filterExpression: undefined, topGroups: undefined, valuationClientAgreementId: undefined,
    rowGroups: preset.Data.sorted.Row, colGroups: [], measurements: [], selections: [],
    supplierBasis: requestSupplierBasis(preset.Data) })
  const updated = retainStoredTemplateFields({ ...saved.Data, SUPPLIERBASIS: basis } as never, built)
  expect(requestSupplierBasis(updated)).toBe(basis)
  expect(updated).not.toHaveProperty('SupplierBasis')
  expect(updated).not.toHaveProperty('SUPPLIERBASIS')
  if (basis === undefined) expect(updated).not.toHaveProperty('supplierBasis')
})

it('preserves an ordinary calculation when applying either supplier layout', () => {
  const current = defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31')
  for (const id of ['recorded-supplier-batch-gross-profit', 'supplier-registrar-warehouse'] as const) {
    const preset = datasetPresetRequest(dataset, id, current)!
    expect(preset.Data.supplierBasis).toBe(0)
    expect(preset.Data.sorted.Row.map(field => field.type)).toEqual([78, 4, 21])
    expect(datasetConfigurationError(preset.Data, dataset)).toBeNull()
  }
})

it('changes supplier layout without resetting AMG, both-world omission or the saved world alias', () => {
  const base = defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31')
  delete base.supplierSourceWorld
  for (const world of [undefined, 1]) {
    const current = { ...base, ...(world === undefined ? {} : { SupplierSourceWorld: world }) }
    for (const id of ['recorded-supplier-batch-gross-profit', 'supplier-registrar-warehouse'] as const) {
      const preset = datasetPresetRequest(dataset, id, current)!
      expect(preset.Data).not.toHaveProperty('supplierSourceWorld')
      expect(preset.Data.SupplierSourceWorld).toBe(world)
      if (world === undefined) expect(preset.Data).not.toHaveProperty('SupplierSourceWorld')
      expect(preset.Data.supplierBasis).toBe(0)
      expect(datasetConfigurationError(preset.Data, dataset)).toBeNull()
    }
  }
})
