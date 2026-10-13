import { expect, it } from 'vitest'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest } from './bug1274WorkbookLaunch'
import { normalizeNativeExactFilterDataset } from './nativeExactFilters'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { datasetConfigurationError, datasetGroupings, datasetMeasurements, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { encodeReportWorkspaceSnapshot } from './reportWorkspaceDraft'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
import { isProfitReadModeCapability, profitReadModeConfigurationError, requestProfitReadMode } from './profitReadMode'
import { profitDayDataset, profitSupplierDataset, profitReadModeCapability } from './profitReadMode.test-fixtures'

it.each([profitDayDataset, profitSupplierDataset])('keeps legacy defaults and presets unopted for source $DataSource', dataset => {
  const original = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30')
  expect(Object.hasOwn(original, 'profitReadMode')).toBe(false)
  const launch = availableBug1274WorkbookLaunches([dataset])[0]
  const workbook = bug1274WorkbookRequest(original, launch)
  expect(requestProfitReadMode(workbook)).toBeUndefined()
  expect(datasetConfigurationError(workbook, dataset)).toBeNull()
  const current = { ...workbook, profitReadMode: 0, workbookPresentation: undefined }
  expect(datasetConfigurationError(current, dataset)).toBeNull()
  const preset = datasetPresetRequest(dataset, dataset.DataSource === 35
    ? 'recorded-sale-gross-profit-by-day-organization' : 'recorded-supplier-batch-gross-profit', current)
  expect(preset).not.toBeNull()
  expect(requestProfitReadMode(preset!.Data)).toBe(0)
  expect(bug1274WorkbookRequest(current, launch).workbookPresentation).toBeUndefined()
})

it.each([profitDayDataset, profitSupplierDataset])('limits current mode to31days even when original shape accepts months for source $DataSource', dataset => {
  const launch = availableBug1274WorkbookLaunches([dataset])[0]
  const original = bug1274WorkbookRequest(defaultDatasetRequest(dataset, '2026-08-01', '2026-09-30'), launch)
  expect(datasetConfigurationError(original, dataset)).toBeNull()
  expect(datasetConfigurationError({ ...original, profitReadMode: 1 }, dataset)).toBeNull()
  expect(datasetConfigurationError({ ...original, profitReadMode: 0, workbookPresentation: undefined }, dataset)).toContain('31')
})

it.each([0, 1, null, undefined])('round trips explicit mode %s through builder, saved template and draft', mode => {
  const dataset = profitSupplierDataset
  const original = { ...defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30'), ProfitReadMode: mode }
  const normalized = normalizeSavedTemplate({ Id: 'stored', Revision: 1, UpdatedAtUtc: '2026-10-13T00:00:00Z', Name: 'saved', Data: { From: original.from, To: original.to, DataSource: original.dataSource,
    Sorted: original.sorted, Selections: [], ProfitReadMode: mode, SupplierBasis: 0, SupplierSourceWorld: 0 } })!
  expect(requestProfitReadMode(normalized.Data)).toBe(mode)
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

it('refuses current workbook presentation and restores supplier current drafts without a source-world filter', () => {
  const day = bug1274WorkbookRequest(defaultDatasetRequest(profitDayDataset, '2026-09-01', '2026-09-30'), availableBug1274WorkbookLaunches([profitDayDataset])[0])
  expect(datasetConfigurationError({ ...day, profitReadMode: 0 }, profitDayDataset)).toContain('Додаткові поля')
  const data = { ...defaultDatasetRequest(profitSupplierDataset, day.from, day.to), profitReadMode: 0, supplierSourceWorld: undefined }
  const snapshot = { name: '', data, measurements: datasetMeasurements(profitSupplierDataset), activeTemplate: null, previousPeriod: { from: data.from, to: data.to } }
  expect(reportWorkspaceDraftCompatibility(snapshot, profitSupplierDataset)).toBeNull()
  expect(datasetGroupings(profitSupplierDataset).some(field => field.type === 78)).toBe(true)
})
