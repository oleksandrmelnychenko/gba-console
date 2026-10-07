import { expect, it } from 'vitest'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { dayOrganizationGrossProfitConfigurationError } from './dayOrganizationGrossProfit'
import { nativeReportMeasurementUnit, usesNativeReportLookup } from './nativeReportProfiles'
import { isDayOrganizationBasisCapability, requestDayOrganizationBasis } from './dayOrganizationBasis'
import { normalizeNativeExactFilterDataset } from './nativeExactFilters'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { buildReportBuilderRequest } from './reportBuilderRequest'
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
  dayOrganizationBasis: { Version: 1, DefaultBasis: 0, Bases: [0, 1], OperationalMaximumDays: 31,
    SignedRegisterMaximumDays: 1, LegacyInferenceWhenAbsent: true },
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

const fullSourceFilters = {
  productClassification: { Version: 1, SourceWorld: 0,
    ProductKindId: '8AB2005056C0000811DEF956DA4CFDA0', IsService: false },
  sourceOrganizations: { Version: 1, SourceWorld: 'fenix', OrganizationIds: ['00000000000000000000000000000001'] },
  sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: '8AB2005056C0000811DEFC4535BB4D40' },
}

it('defaults to period sales only when the server advertises the exact basis contract', () => {
  const current = defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31')
  expect(current.dayOrganizationBasis).toBe(0)
  expect(defaultDatasetRequest({ ...dataset, dayOrganizationBasis: undefined }, current.from, current.to))
    .not.toHaveProperty('dayOrganizationBasis')
  const camel = { version: 1, defaultBasis: 0, bases: [0, 1], operationalMaximumDays: 31,
    signedRegisterMaximumDays: 1, legacyInferenceWhenAbsent: true }
  expect(isDayOrganizationBasisCapability(camel)).toBe(true)
  const { dayOrganizationBasis: _unused, ...rest } = dataset
  void _unused
  expect(normalizeNativeExactFilterDataset({ ...rest, DayOrganizationBasis: camel })?.dayOrganizationBasis).toEqual(camel)
  for (const bad of [null, { ...camel, version: 2 }, { ...camel, bases: [1, 0] },
    { ...camel, Version: 1 }, { ...camel, operationalMaximumDays: 32 }]) {
    expect(normalizeNativeExactFilterDataset({ ...rest, DayOrganizationBasis: bad })).toBeNull()
  }
  expect(normalizeNativeExactFilterDataset({ ...dataset, DayOrganizationBasis: camel })).toBeNull()
})

it('runs full source filters and local product selection for a month only on the explicit period basis', () => {
  const month = { ...defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31'), ...fullSourceFilters,
    selections: [{ IsChecked: true, SelectedField: { Type: 1, Name: 'Товар' },
      FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: '42' }, Name: 'Товар 42', Value: 0 }] }] }
  expect(datasetConfigurationError(month, dataset)).toBeNull()
  expect(datasetConfigurationError({ ...month, dayOrganizationBasis: 1 }, dataset)).toContain('один день')
  expect(datasetConfigurationError({ ...month, dayOrganizationBasis: null }, dataset)).toContain('один день')
  expect(datasetConfigurationError({ ...month, dayOrganizationBasis: undefined }, dataset)).toContain('один день')
  const signed = { ...month, from: month.to, selections: [], dayOrganizationBasis: 1 }
  expect(datasetConfigurationError(signed, dataset)).toBeNull()
  expect(datasetConfigurationError({ ...signed, dayOrganizationBasis: null }, dataset)).toBeNull()
  expect(datasetConfigurationError({ ...signed, sourceBuyerSubtree: undefined }, dataset)).toContain('оберіть')
  expect(datasetConfigurationError({ ...signed, productClassification: { ...fullSourceFilters.productClassification,
    IsService: true } }, dataset)).toContain('без послуг')
})

it.each(['0', true, 2, -1, 0.5])('refuses a malformed basis %s before applying the request', basis => {
  const request = { ...defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31'), dayOrganizationBasis: basis }
  expect(datasetConfigurationError(request, dataset)).toContain('Некоректний спосіб')
})

it('refuses duplicate null aliases, wrong datasets and unadvertised explicit modes', () => {
  const request = defaultDatasetRequest(dataset, '2026-07-01', '2026-07-31')
  expect(datasetConfigurationError({ ...request, dayOrganizationBasis: null, DayOrganizationBasis: null }, dataset)).toContain('двічі')
  expect(dayOrganizationGrossProfitConfigurationError({ ...request, dataSource: 2 })).toContain('лише')
  expect(datasetConfigurationError(request, { ...dataset, dayOrganizationBasis: undefined })).toContain('Сервер')
})

it.each([null, 1])('preserves saved PascalCase basis %s through normalization, layout, builder and update', basis => {
  const request = { ...defaultDatasetRequest(dataset, '2026-07-01', '2026-07-01'), ...fullSourceFilters }
  const wire = { Id: crypto.randomUUID(), Revision: 1, Name: 'Збережений прибуток',
    UpdatedAtUtc: '2026-07-01T00:00:00.000Z', Data: {
    DataSource: 35, From: request.from, To: request.to, Sorted: request.sorted, Selections: [],
    ...fullSourceFilters, DayOrganizationBasis: basis,
  } }
  const saved = normalizeSavedTemplate(wire)
  expect(saved.Data.DayOrganizationBasis).toBe(basis)
  expect(saved.Data).not.toHaveProperty('dayOrganizationBasis')
  const preset = datasetPresetRequest(dataset, 'recorded-sale-gross-profit-by-day-organization', saved.Data)!
  expect(preset.Data.DayOrganizationBasis).toBe(basis)
  expect(preset.Data).not.toHaveProperty('dayOrganizationBasis')
  const built = buildReportBuilderRequest({ dataSource: 35, from: request.from, to: request.to,
    ordering: undefined, filterExpression: undefined, topGroups: undefined, valuationClientAgreementId: undefined,
    rowGroups: request.sorted.Row, colGroups: [], measurements: [], selections: [],
    dayOrganizationBasis: requestDayOrganizationBasis(preset.Data) })
  expect(built.dayOrganizationBasis).toBe(basis)
  const updated = retainStoredTemplateFields(saved.Data, { ...request, dayOrganizationBasis: basis })
  expect(updated.dayOrganizationBasis).toBe(basis)
  expect(updated).not.toHaveProperty('DayOrganizationBasis')
  expect(retainStoredTemplateFields({ ...saved.Data, DAYORGANIZATIONBASIS: basis } as never, { ...request, dayOrganizationBasis: basis }))
    .not.toHaveProperty('DAYORGANIZATIONBASIS')
  const absent = { ...saved.Data }
  delete absent.DayOrganizationBasis
  const absentPreset = datasetPresetRequest(dataset, 'recorded-sale-gross-profit-by-day-organization', absent)!
  expect(absentPreset.Data).not.toHaveProperty('dayOrganizationBasis')
  expect(absentPreset.Data).not.toHaveProperty('DayOrganizationBasis')
})
