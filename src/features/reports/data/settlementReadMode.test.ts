import { expect, it } from 'vitest'
import { normalizeSavedTemplate, parseReportDatasets } from '../api/reportWorkspaceApi'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest, SETTLEMENT_READ_MODE_NOTICE } from './bug1274WorkbookLaunch'
import { groupedSettlementConfigurationError } from './groupedSettlementPeriod'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { datasetConfigurationError, datasetMeasurements, datasetPresetRequest, defaultDatasetRequest, withDefaultReadModes } from './reportDatasets'
import { reportDatasets } from './reportDatasets.test-fixtures'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
import { settlementPeriodConfigurationError } from './settlementPeriod'
import { settlementPeriodRequest } from './settlementPeriod.test-fixtures'
import { isSettlementReadModeCapability, requestSettlementReadMode, settlementReadModeConfigurationError } from './settlementReadMode'
import { settlementModeDataset as dataset, settlementReadModeCapability as capability } from './settlementReadMode.test-fixtures'

const today = '2026-10-13'
const hasMode = (value: object) => Object.keys(value).some(key => key.toLowerCase() === 'settlementreadmode')
const request = (mode: unknown) => ({ ...defaultDatasetRequest(dataset, '2025-01-01', today), settlementReadMode: mode })
const { settlementReadMode: _capability, ...plain } = dataset
void _capability
const unmarked = (from: string, to: string) => {
  const result = defaultDatasetRequest(dataset, from, to)
  delete result.settlementReadMode
  return result
}
const organization = { IsChecked: true, SelectedField: { Type: 0, Name: 'Організація' },
  FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: { Id: '1' }, Value: 0, Name: 'Організація' }] }

it('accepts only the exact four-field capability with case-insensitive names', () => {
  expect(isSettlementReadModeCapability(capability)).toBe(true)
  expect(isSettlementReadModeCapability(Object.fromEntries(Object.entries(capability).map(([key, value]) => [key.toLowerCase(), value])))).toBe(true)
  const { LegacyInferencePreserved: _legacy, ...missing } = capability
  void _legacy
  for (const value of [null, [], {}, missing, { ...capability, Extra: true }, { ...capability, version: 1 },
    { ...missing, CurrentDocumentsMaximumDays: 120 }, { ...capability, Version: 2 }, { ...capability, SupportedModes: [1, 0] },
    { ...capability, SupportedModes: ['0', '1'] }, { ...capability, SupportedModes: [0] }, { ...capability, SupportedModes: [0, 1, 2] },
    { ...capability, CurrentDocumentsMaximumMonths: 121 }, { ...capability, CurrentDocumentsMaximumMonths: '120' },
    { ...capability, LegacyInferencePreserved: false }])
    expect(isSettlementReadModeCapability(value)).toBe(false)
})

it('normalizes the dataset capability and hides unknown or misplaced ones without refusing the dataset list', () => {
  expect(parseReportDatasets([{ ...plain, SettlementReadMode: capability }])[0].settlementReadMode).toEqual(capability)
  for (const invalid of [{ ...capability, Extra: 1 }, { ...capability, CurrentDocumentsMaximumMonths: 60 }, null, 'yes']) {
    const [parsed] = parseReportDatasets([{ ...plain, settlementReadMode: invalid }])
    expect(hasMode(parsed)).toBe(false)
    expect(availableBug1274WorkbookLaunches([parsed]).some(launch => launch.notice.includes(SETTLEMENT_READ_MODE_NOTICE))).toBe(false)
  }
  expect(hasMode(parseReportDatasets([{ ...plain, settlementReadMode: capability, SettlementReadMode: capability }])[0])).toBe(false)
  const parsed = parseReportDatasets([{ ...reportDatasets[0], settlementReadMode: capability }, plain])
  expect(parsed.map(item => item.DataSource)).toEqual([reportDatasets[0].DataSource, 41])
  expect(parsed.some(hasMode)).toBe(false)
})

it.each([0, 1])('admits explicit mode %s on grouped Fenix buyers with the original 120-month period to today', mode => {
  expect(groupedSettlementConfigurationError(request(mode), dataset, today)).toBeNull()
  expect(groupedSettlementConfigurationError(request(mode), { ...dataset, groupedSettlementPeriod: capabilityWithoutNormalPeriod() }, today)).toBeNull()
  expect(groupedSettlementConfigurationError({ ...request(mode), from: '2024-12-31' }, dataset, today)).toContain('120')
  expect(groupedSettlementConfigurationError({ ...request(mode), to: '2026-10-14' }, dataset, today)).toContain('сьогодні')
  expect(groupedSettlementConfigurationError({ ...request(mode), to: '2034-12-31' }, dataset, '2035-01-01')).toBeNull()
  expect(groupedSettlementConfigurationError({ ...request(mode), to: '2035-01-01' }, dataset, '2035-01-01')).toContain('120')
  expect(datasetConfigurationError({ ...request(mode), to: '2026-09-30' }, dataset)).toBeNull()
})

it('rejects malformed, duplicated, misplaced or unconfirmed modes and non-Fenix scopes', () => {
  for (const mode of ['0', true, 2, {}, []])
    expect(groupedSettlementConfigurationError(request(mode), dataset, today)).toContain('Некоректне')
  expect(groupedSettlementConfigurationError({ ...request(0), SettlementReadMode: 0 }, dataset, today)).toContain('двічі')
  expect(settlementReadModeConfigurationError({ ...request(0), dataSource: 40 })).toContain('лише')
  expect(datasetConfigurationError({ ...reportDatasetRequest(), settlementReadMode: 0 }, reportDatasets[0])).toContain('лише')
  expect(groupedSettlementConfigurationError(request(0), plain, today)).toContain('Сервер')
  expect(groupedSettlementConfigurationError({ ...request(1), sourceBuyerSubtree: undefined }, dataset, today)).toContain('«Покупці»')
  expect(groupedSettlementConfigurationError({ ...request(0), sourceBuyerSubtree: undefined,
    groupedSettlementPeriod: { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' } }, dataset, today)).toContain('Fenix')
  expect(settlementPeriodConfigurationError({ ...settlementPeriodRequest(), settlementReadMode: 0 }, dataset)).toContain('поточних договорів')
  expect(groupedSettlementConfigurationError(request(null), dataset, today)).toBeNull()
  expect(groupedSettlementConfigurationError({ ...request(undefined), from: '2026-10-01' }, plain, today)).toBeNull()
})

it('opens new grouped Fenix buyer requests on current documents and leaves other scopes unmarked', () => {
  const current = defaultDatasetRequest(dataset, '2025-01-01', today)
  expect(current.settlementReadMode).toBe(0)
  expect(groupedSettlementConfigurationError(current, dataset, today)).toBeNull()
  expect(hasMode(defaultDatasetRequest(plain, '2025-01-01', today))).toBe(false)
  const { settlementReadMode: _mode, ...scope } = current
  void _mode
  const amg = { ...scope, sourceBuyerSubtree: undefined,
    groupedSettlementPeriod: { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' } }
  for (const other of [amg, { ...scope, sourceBuyerSubtree: undefined }, settlementPeriodRequest()])
    expect(withDefaultReadModes(other, dataset)).toBe(other)
})

it('applies current documents to a saved request without a mode and reports the current-document limits', () => {
  const saved = unmarked('2024-12-01', '2024-12-31')
  expect(groupedSettlementConfigurationError(saved, dataset, today)).toContain('120')
  const current = withDefaultReadModes(saved, dataset)
  expect(current.settlementReadMode).toBe(0)
  expect(saved).not.toHaveProperty('settlementReadMode')
  expect(groupedSettlementConfigurationError(current, dataset, today)).toContain('120')
  for (const mode of [0, 1, null]) {
    const explicit = { ...saved, SettlementReadMode: mode }
    expect(withDefaultReadModes(explicit, dataset)).toBe(explicit)
  }
  expect(withDefaultReadModes(saved, plain)).toBe(saved)
  const filtered = withDefaultReadModes({ ...unmarked('2025-01-01', today), selections: [organization] }, dataset)
  expect(groupedSettlementConfigurationError(filtered, dataset, today)).toBe('Взаєморозрахунки з документів GBA формуються для всієї групи «Покупці» без додаткових відборів.')
  expect(groupedSettlementConfigurationError({ ...filtered, selections: [{ ...organization, IsChecked: false }] }, dataset, today)).toBeNull()
  expect(groupedSettlementConfigurationError({ ...filtered, settlementReadMode: 1 }, dataset, today)).toBeNull()
  const grouped = { ...dataset, sourceCounterpartyGroups: { Version: 1, SourceWorld: 'fenix', MaximumGroupIds: 64,
    UsesCurrentCapturedHierarchy: true, ExclusionsTakePrecedence: true, GroupIdFormat: '32 hexadecimal characters (16 bytes)' } }
  const groups = { ...filtered, selections: [], sourceCounterpartyGroups: { Version: 1, SourceWorld: 'fenix', IncludeGroupIds: ['A'.repeat(32)], ExcludeGroupIds: [] } }
  expect(groupedSettlementConfigurationError(groups, grouped, today)).toContain('без додаткових відборів')
  expect(groupedSettlementConfigurationError({ ...groups, settlementReadMode: 1 }, grouped, today)).toBeNull()
})

it.each([0, 1, null, undefined])('round trips mode %s through saved template, builder, retained fields, preset and draft', mode => {
  const original = unmarked('2025-01-01', '2026-09-30')
  const normalized = normalizeSavedTemplate({ Id: 'stored', Revision: 1, UpdatedAtUtc: '2026-10-13T00:00:00Z', Name: 'saved', Data: {
    DataSource: 41, From: original.from, To: original.to, Sorted: original.sorted, Selections: [],
    GroupedSettlementPeriod: original.groupedSettlementPeriod, SourceBuyerSubtree: original.sourceBuyerSubtree,
    ...(mode !== undefined ? { SettlementReadMode: mode } : {}) } })
  expect(hasMode(normalized.Data)).toBe(mode !== undefined)
  expect(requestSettlementReadMode(normalized.Data)).toBe(mode)
  expect(requestSettlementReadMode(withDefaultReadModes(normalized.Data, dataset))).toBe(mode === undefined ? 0 : mode)
  expect(datasetConfigurationError(normalized.Data, dataset)).toBeNull()
  const data = buildReportBuilderRequest({ dataSource: 41, from: original.from, to: original.to,
    groupedSettlementPeriod: original.groupedSettlementPeriod, sourceBuyerSubtree: original.sourceBuyerSubtree,
    settlementReadMode: requestSettlementReadMode(normalized.Data), ordering: undefined, filterExpression: undefined,
    topGroups: undefined, valuationClientAgreementId: undefined, rowGroups: original.sorted.Row, colGroups: [],
    measurements: datasetMeasurements(dataset, original.sorted.Measurements), selections: [] })
  expect(hasMode(data)).toBe(mode !== undefined)
  if (mode === undefined) expect(data).toEqual(original)
  expect(requestSettlementReadMode(retainStoredTemplateFields(normalized.Data, data))).toBe(mode)
  expect(retainStoredTemplateFields(normalized.Data, original)).not.toHaveProperty('SettlementReadMode')
  const preset = datasetPresetRequest(dataset, 'native-settlement-period-agreement-currency', data)
  expect(preset).not.toBeNull()
  expect(hasMode(preset!.Data)).toBe(mode !== undefined)
  expect(requestSettlementReadMode(preset!.Data)).toBe(mode)
  const presented = { ...data, workbookPresentation: { version: 1, additionalFields: [30], ordering: null } }
  const snapshot = { name: 'saved', data: presented, measurements: datasetMeasurements(dataset, data.sorted.Measurements),
    activeTemplate: null, previousPeriod: { from: data.from, to: data.to } }
  expect(reportWorkspaceDraftCompatibility(snapshot, dataset)).toBeNull()
  expect(reportWorkspaceDraftCompatibility(snapshot, plain)).toBe(mode == null ? null
    : 'Сервер не підтвердив вибір джерела розрахунку взаєморозрахунків. Чернетка збережена без змін.')
})

it('opens both workbook launch requests on current documents and mentions the source only with the capability', () => {
  const launches = availableBug1274WorkbookLaunches([dataset])
  const previous = availableBug1274WorkbookLaunches([plain])
  expect(launches.map(launch => launch.fileName)).toEqual(['Взаємороз всі.xls', 'ДБіторка.xls'])
  launches.forEach((launch, index) => {
    expect(launch.notice).toBe(`${previous[index].notice.replace('Період до 31 дня може', 'Період може')} ${SETTLEMENT_READ_MODE_NOTICE}`)
    expect(previous[index].notice).not.toContain('джерел')
    const opened = bug1274WorkbookRequest(defaultDatasetRequest(dataset, '2026-09-30', '2026-09-30'), launch)
    expect(opened.settlementReadMode).toBe(0)
    const legacy = bug1274WorkbookRequest(defaultDatasetRequest(plain, '2026-09-30', '2026-09-30'), previous[index])
    expect(hasMode(legacy)).toBe(false)
    expect(opened).toEqual({ ...legacy, settlementReadMode: 0 })
    expect(datasetConfigurationError(opened, dataset)).toBeNull()
    expect(datasetConfigurationError({ ...opened, from: '2025-01-01' }, dataset)).toBeNull()
    expect(datasetConfigurationError({ ...opened, from: '2024-12-31' }, dataset)).toContain('120')
    const unopted = bug1274WorkbookRequest(unmarked('2026-09-30', '2026-09-30'), launch)
    expect(hasMode(unopted)).toBe(false)
    expect(bug1274WorkbookRequest({ ...unopted, settlementReadMode: 1 }, launch)).toEqual({ ...unopted, settlementReadMode: 1 })
  })
})

function capabilityWithoutNormalPeriod() {
  const { OriginalNormalMaximumMonths: _months, OriginalNormalMinimumDate: _date, ...rest } = dataset.groupedSettlementPeriod as Record<string, unknown>
  void _months; void _date
  return rest
}

function reportDatasetRequest() {
  return defaultDatasetRequest(reportDatasets[0], '2026-09-01', '2026-09-30')
}
