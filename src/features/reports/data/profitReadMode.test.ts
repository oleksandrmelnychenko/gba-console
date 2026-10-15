import { expect, it } from 'vitest'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest } from './bug1274WorkbookLaunch'
import { normalizeNativeExactFilterDataset } from './nativeExactFilters'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { datasetConfigurationError, datasetGroupings, datasetMeasurements, datasetPresetRequest, defaultDatasetRequest,
  withDefaultReadModes } from './reportDatasets'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { encodeReportWorkspaceSnapshot } from './reportWorkspaceDraft'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
import { isProfitReadModeCapability, profitReadModeConfigurationError, requestProfitReadMode } from './profitReadMode'
import { profitDayDataset, profitSupplierDataset, profitReadModeCapability } from './profitReadMode.test-fixtures'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from './dayOrganizationGrossProfit'
import { FENIX_BUYERS_ROOT_ID } from './nativeExactFilters'

const presetId = (dataset: typeof profitDayDataset) => dataset.DataSource === 35
  ? 'recorded-sale-gross-profit-by-day-organization' : 'recorded-supplier-batch-gross-profit'
const unmarked = (dataset: typeof profitDayDataset, from: string, to: string) => {
  const request = defaultDatasetRequest(dataset, from, to)
  delete request.profitReadMode
  return dataset.DataSource === 38 ? { ...request, supplierSourceWorld: 0 } : request
}

it.each([profitDayDataset, profitSupplierDataset])('opens new requests and the workbook launch on current documents for source $DataSource', dataset => {
  const current = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30')
  expect(current.profitReadMode).toBe(0)
  expect(Object.hasOwn(current, 'supplierSourceWorld')).toBe(false)
  expect(datasetConfigurationError(current, dataset)).toBeNull()
  const launch = availableBug1274WorkbookLaunches([dataset])[0]
  expect(launch.notice).toContain('«Поточні документи GBA»')
  expect(launch.notice).toContain('до 31 календарних днів')
  const workbook = bug1274WorkbookRequest(current, launch)
  if (dataset.DataSource === 35) {
    expect(workbook).toMatchObject({ profitReadMode: 0, dayOrganizationBasis: 0,
      productClassification: { ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false },
      sourceOrganizations: { OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] },
      sourceBuyerSubtree: { BuyerRootId: FENIX_BUYERS_ROOT_ID },
      workbookPresentation: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' } })
    expect(datasetConfigurationError(workbook, dataset)).toBeNull()
    expect(launch.notice).toContain('ФОП Пархоменко не синхронізується в GBA')
    expect(current).not.toHaveProperty('sourceOrganizations')
  } else {
    expect(workbook).toBe(current)
    expect(workbook.workbookPresentation).toBeUndefined()
    expect(workbook.sourceOrganizations).toBeUndefined()
  }
  const { profitReadMode: _capability, ...previous } = dataset
  void _capability
  const legacy = defaultDatasetRequest(previous, '2026-09-01', '2026-09-30')
  expect(Object.hasOwn(legacy, 'profitReadMode')).toBe(false)
  if (dataset.DataSource === 38) expect(legacy.supplierSourceWorld).toBe(0)
  expect(availableBug1274WorkbookLaunches([previous])[0].notice).not.toContain('Поточні документи GBA')
  const wide = { ...dataset, profitReadMode: { ...profitReadModeCapability, CurrentDocumentsMaximumDays: 62 } }
  expect(availableBug1274WorkbookLaunches([wide])[0].notice).toContain('до 62 календарних днів')
})

it.each([profitDayDataset, profitSupplierDataset])('keeps the request mode or its absence through presets for source $DataSource', dataset => {
  for (const mode of [0, 1, undefined]) {
    const request = mode === undefined ? unmarked(dataset, '2026-09-01', '2026-09-30')
      : { ...defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30'), profitReadMode: mode }
    const preset = datasetPresetRequest(dataset, presetId(dataset), request)
    expect(preset).not.toBeNull()
    expect(requestProfitReadMode(preset!.Data)).toBe(mode)
  }
})

it.each([profitDayDataset, profitSupplierDataset])('applies current documents to a saved request without a mode and reports its limits for source $DataSource', dataset => {
  const launch = availableBug1274WorkbookLaunches([dataset])[0]
  const saved = bug1274WorkbookRequest(unmarked(dataset, '2026-08-01', '2026-09-30'), launch)
  expect(datasetConfigurationError(saved, dataset)).toBeNull()
  expect(datasetConfigurationError({ ...saved, profitReadMode: 1 }, dataset)).toBeNull()
  const current = withDefaultReadModes(saved, dataset)
  expect(current.profitReadMode).toBe(0)
  expect(saved).not.toHaveProperty('profitReadMode')
  expect(datasetConfigurationError(current, dataset)).toContain('31')
  expect(datasetConfigurationError({ ...current, workbookPresentation: undefined }, dataset)).toContain('31')
  for (const mode of [0, 1, null]) {
    const explicit = { ...saved, ProfitReadMode: mode }
    expect(withDefaultReadModes(explicit, dataset)).toBe(explicit)
  }
  const { profitReadMode: _capability, ...previous } = dataset
  void _capability
  expect(withDefaultReadModes(saved, previous)).toBe(saved)
  const otherBasis = dataset.DataSource === 35 ? { ...saved, dayOrganizationBasis: 1 } : { ...saved, supplierBasis: 1 }
  expect(withDefaultReadModes(otherBasis, dataset)).toBe(otherBasis)
  const withoutBasis = dataset.DataSource === 35 ? { ...saved, dayOrganizationBasis: undefined } : { ...saved, supplierBasis: null }
  expect(withDefaultReadModes(withoutBasis, dataset)).toBe(withoutBasis)
})

it.each([0, 1, null, undefined])('round trips explicit mode %s through builder, saved template and draft', mode => {
  const dataset = profitSupplierDataset
  const original = { ...unmarked(dataset, '2026-09-01', '2026-09-30'), ProfitReadMode: mode }
  const normalized = normalizeSavedTemplate({ Id: 'stored', Revision: 1, UpdatedAtUtc: '2026-10-13T00:00:00Z', Name: 'saved', Data: { From: original.from, To: original.to, DataSource: original.dataSource,
    Sorted: original.sorted, Selections: [], ...(mode !== undefined ? { ProfitReadMode: mode } : {}), SupplierBasis: 0, SupplierSourceWorld: 0 } })!
  expect(requestProfitReadMode(normalized.Data)).toBe(mode)
  expect(requestProfitReadMode(withDefaultReadModes(normalized.Data, dataset))).toBe(mode === undefined ? 0 : mode)
  const data = buildReportBuilderRequest({ ...original, dataSource: dataset.DataSource, profitReadMode: requestProfitReadMode(normalized.Data),
    ordering: undefined, filterExpression: undefined, topGroups: undefined, valuationClientAgreementId: undefined,
    rowGroups: original.sorted.Row, colGroups: [], measurements: datasetMeasurements(dataset, original.sorted.Measurements), selections: [] })
  expect(requestProfitReadMode(data)).toBe(mode)
  expect(Object.hasOwn(data, 'profitReadMode')).toBe(mode !== undefined)
  expect(retainStoredTemplateFields(original, data).ProfitReadMode).toBeUndefined()
  const snapshot = { name: 'saved', data, measurements: datasetMeasurements(dataset, data.sorted.Measurements), activeTemplate: null,
    previousPeriod: { from: data.from, to: data.to } }
  const encoded = encodeReportWorkspaceSnapshot(snapshot)
  expect(encoded.ok).toBe(true)
  expect(reportWorkspaceDraftCompatibility(snapshot, dataset)).toBeNull()
})

it('rejects ambiguous, unsupported and coercible modes; requires capability and explicit operational basis', () => {
  const request = defaultDatasetRequest(profitDayDataset, '2026-09-01', '2026-09-30')
  for (const mode of ['0', true, 2, {}, []]) expect(profitReadModeConfigurationError({ ...request, profitReadMode: mode }, profitDayDataset)).toContain('Некоректне')
  expect(profitReadModeConfigurationError({ ...request, profitReadMode: 0, ProfitReadMode: 0 })).toContain('двічі')
  expect(profitReadModeConfigurationError({ ...request, profitReadMode: 0, dayOrganizationBasis: undefined })).toContain('Продажі')
  expect(profitReadModeConfigurationError({ ...request, profitReadMode: 0, dayOrganizationBasis: 1 })).toContain('Продажі')
  expect(profitReadModeConfigurationError({ ...request, profitReadMode: 0 }, { ...profitDayDataset, profitReadMode: undefined })).toContain('Сервер')
  expect(profitReadModeConfigurationError({ ...request, profitReadMode: 0, dataSource: 40 })).toContain('лише')
  expect(datasetConfigurationError({ ...request, profitReadMode: 1 }, profitDayDataset)).toContain('відбори Fenix')
})

it('normalizes only the precise server capability and rejects duplicate aliases', () => {
  expect(isProfitReadModeCapability(profitReadModeCapability)).toBe(true)
  const { profitReadMode: _mode, ...rest } = profitDayDataset; void _mode
  expect(normalizeNativeExactFilterDataset({ ...rest, ProfitReadMode: profitReadModeCapability })?.profitReadMode).toEqual(profitReadModeCapability)
  for (const mode of [null, { ...profitReadModeCapability, SupportedModes: ['0', '1'] },
    { ...profitReadModeCapability, CurrentDocumentsMaximumDays: 32 }, { ...profitReadModeCapability, version: 1 }])
    expect(normalizeNativeExactFilterDataset({ ...rest, profitReadMode: mode })).toBeNull()
  expect(normalizeNativeExactFilterDataset({ ...profitDayDataset, ProfitReadMode: profitReadModeCapability })).toBeNull()
})

it('accepts current workbook presentation and restores supplier current drafts without a source-world filter', () => {
  const day = bug1274WorkbookRequest(unmarked(profitDayDataset, '2026-09-01', '2026-09-30'), availableBug1274WorkbookLaunches([profitDayDataset])[0])
  expect(day.workbookPresentation).toEqual({ version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' })
  expect(datasetConfigurationError({ ...day, profitReadMode: 0 }, profitDayDataset)).toBeNull()
  const data = { ...defaultDatasetRequest(profitSupplierDataset, day.from, day.to), profitReadMode: 0, supplierSourceWorld: undefined }
  const snapshot = { name: '', data, measurements: datasetMeasurements(profitSupplierDataset), activeTemplate: null, previousPeriod: { from: data.from, to: data.to } }
  expect(reportWorkspaceDraftCompatibility(snapshot, profitSupplierDataset)).toBeNull()
  expect(datasetGroupings(profitSupplierDataset).some(field => field.type === 78)).toBe(true)
})
