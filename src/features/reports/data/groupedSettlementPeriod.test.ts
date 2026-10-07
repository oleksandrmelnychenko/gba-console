import { expect, it } from 'vitest'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { groupedSettlementDataset as dataset, groupedSettlementRequest as request } from './groupedSettlementPeriod.test-fixtures'
import { settlementPeriodRequest } from './settlementPeriod.test-fixtures'
import { datasetConfigurationError, datasetGroupings, datasetPresetRequest, datasetPresets, defaultDatasetRequest, datasetMeasurements } from './reportDatasets'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { availableBug1274WorkbookLaunches } from './bug1274WorkbookLaunch'
import { cloneGroupedSettlementAliases, groupedSettlementCapability, groupedSettlementConfigurationError,
  groupedSettlementRows, groupedWorkbookRequest, normalizeGroupedSettlementDataset,
  requestGroupedSettlementPeriod, settlementFormDataset, settlementMaximumDate } from './groupedSettlementPeriod'
import { settlementPeriodConfigurationError } from './settlementPeriod'

it('opts only fresh advertised drafts into current buyer agreements and keeps both workbook forms', () => {
  const current = request()
  expect(current.groupedSettlementPeriod).toEqual({ Version: 1, SourceWorld: 'Fenix', CurrencyBasis: 'SettlementCurrency' })
  expect(current.sourceBuyerSubtree).toMatchObject({ SourceWorld: 'fenix' })
  expect(current.sorted.Row.map(field => field.type)).toEqual([4, 41, 76])
  expect(current.sorted.Measurements.map(field => field.Type)).toEqual([88, 89, 90, 91])
  expect(datasetConfigurationError(current, dataset)).toBeNull()
  const debtor = groupedWorkbookRequest(current, false)
  expect(debtor.sorted.Row.map(field => field.type)).toEqual([4, 76])
  expect(datasetConfigurationError(debtor, dataset)).toBeNull()
  expect(current.sorted.Row.map(field => field.type)).toEqual([4, 41, 76])
  const launches = availableBug1274WorkbookLaunches([dataset])
  expect(launches.map(item => [item.fileName, item.currencyAxis])).toEqual([
    ['Взаємороз всі.xls', true], ['ДБіторка.xls', false],
  ])
  expect(launches.every(item => item.notice.includes('порожніми'))).toBe(true)
})

it('normalizes precise nested capability casing and rejects ambiguous or inconsistent contracts', () => {
  const cap = dataset.groupedSettlementPeriod as Record<string, unknown>
  const camel = Object.fromEntries(Object.entries(cap).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value]))
  expect(groupedSettlementCapability(camel)).toEqual(cap)
  const { groupedSettlementPeriod: _cap, ...base } = dataset
  void _cap
  expect(normalizeGroupedSettlementDataset({ ...base, GroupedSettlementPeriod: camel })?.groupedSettlementPeriod).toEqual(cap)
  for (const patch of [{ version: 1 }, { RequiresCommonSourceObservation: true }, { PreservesUnavailableValues: false },
    { CurrentDaySupported: false }, { Filters: [0, 6] }, { RowLayouts: [[4, 76]] }, { MaximumDays: 32 },
    { SourceWorlds: [['Fenix'], 'Amg'] }])
    expect(groupedSettlementCapability({ ...cap, ...patch })).toBeNull()
  expect(normalizeGroupedSettlementDataset({ ...dataset, GroupedSettlementPeriod: cap })).toBeNull()
  expect(normalizeGroupedSettlementDataset({ ...dataset, DataSource: 35 })).toBeNull()
})

it.each([undefined, null])('preserves saved omitted/null grouped selector %s without upgrading the exact agreement', basis => {
  const legacy = settlementPeriodRequest()
  const saved = normalizeSavedTemplate({ Id: crypto.randomUUID(), Revision: 1, UpdatedAtUtc: '2026-09-13T00:00:00Z',
    Name: 'Exact saved agreement', Data: { DataSource: 41, From: legacy.from, To: legacy.to, Sorted: legacy.sorted,
      Selections: [], SettlementPeriod: legacy.settlementPeriod, ...(basis === undefined ? {} : { GroupedSettlementPeriod: basis }) } })
  expect(requestGroupedSettlementPeriod(saved.Data)).toBe(basis)
  expect(datasetConfigurationError(saved.Data, dataset)).toBeNull()
  expect(settlementFormDataset(dataset, basis)?.Filters).toEqual([])
  const preset = datasetPresetRequest(dataset, datasetPresets(dataset)[0].id, saved.Data)!
  expect(preset.Data.sorted.Row.map(field => field.type)).toEqual([4, 41, 76, 77])
  expect(requestGroupedSettlementPeriod(preset.Data)).toBe(basis)
  expect(preset.Data.settlementPeriod).toEqual(legacy.settlementPeriod)
  expect(preset.Data).not.toHaveProperty('sourceBuyerSubtree')
  if (basis === undefined) expect(preset.Data).not.toHaveProperty('groupedSettlementPeriod')
  expect(datasetConfigurationError(preset.Data, dataset)).toBeNull()
})

it('binds exact native include/exclude IDs and boolean trees while rejecting aliases and foreign scope', () => {
  const current = request()
  current.selections = [{ IsChecked: true, SelectedField: { Type: 9, Name: 'Договір' },
    FilterCondition: { Type: 4, Name: 'Не у списку' }, Values: [{ Data: { Id: '9007199254740993', Name: 'Exact' }, Name: 'Exact', Value: 0 }] }]
  current.filterExpression = { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }] } }
  expect(datasetConfigurationError(current, dataset)).toBeNull()
  expect(settlementFormDataset(dataset, current.groupedSettlementPeriod)?.FilterExpression).toBeTruthy()
  expect(settlementPeriodConfigurationError({ ...current, GroupedSettlementPeriod: current.groupedSettlementPeriod }, dataset)).toContain('двічі')
  expect(settlementPeriodConfigurationError({ ...current, settlementPeriod: settlementPeriodRequest().settlementPeriod }, dataset)).toContain('точним договором')
  expect(settlementPeriodConfigurationError({ ...current, dataSource: 35 }, undefined)).toContain('лише')
  const amg = { ...current, groupedSettlementPeriod: { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' } }
  expect(settlementPeriodConfigurationError(amg, dataset)).toContain('Fenix')
  delete amg.sourceBuyerSubtree
  expect(datasetConfigurationError(amg, dataset)).toBeNull()
})

it('allows today with unavailable financial input and rejects future or overlong periods', () => {
  const today = { ...request(), from: '2026-10-01', to: '2026-10-01' }
  expect(groupedSettlementConfigurationError(today, dataset, '2026-10-01')).toBeNull()
  expect(groupedSettlementConfigurationError({ ...today, to: '2026-10-02' }, dataset, '2026-10-01')).toContain('сьогодні')
  expect(groupedSettlementConfigurationError({ ...today, from: '2026-09-01' }, dataset, '2026-10-01')).toBeNull()
  expect(groupedSettlementConfigurationError({ ...today, from: '2026-08-31' }, dataset, '2026-10-01')).toContain('31 день')
  expect(settlementMaximumDate(41, today.groupedSettlementPeriod, '2026-10-01')).toBe('2026-10-01')
  expect(settlementMaximumDate(41, undefined, '2026-10-01')).toBe('2026-09-30')
})

it('clones stored aliases and includes grouped scope in builder, draft and file cancellation fingerprint', () => {
  const current = request()
  const raw = { GroupedSettlementPeriod: current.groupedSettlementPeriod }
  const aliases = cloneGroupedSettlementAliases(raw)
  expect(aliases).toEqual(raw)
  expect(aliases.GroupedSettlementPeriod).not.toBe(raw.GroupedSettlementPeriod)
  const built = buildReportBuilderRequest({ dataSource: 41, from: current.from, to: current.to,
    groupedSettlementPeriod: current.groupedSettlementPeriod, sourceBuyerSubtree: current.sourceBuyerSubtree,
    ordering: undefined, filterExpression: undefined, topGroups: undefined, valuationClientAgreementId: undefined,
    rowGroups: current.sorted.Row, colGroups: [], measurements: datasetMeasurements(dataset, current.sorted.Measurements), selections: [] })
  expect(built).toEqual(current)
  const updated = retainStoredTemplateFields({ ...current, GROUPEDSETTLEMENTPERIOD: null } as never, built)
  expect(updated).not.toHaveProperty('GROUPEDSETTLEMENTPERIOD')
  const changed = { ...built, groupedSettlementPeriod: { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' } }
  expect(JSON.stringify(built)).not.toBe(JSON.stringify(changed))
  const noCapability = defaultDatasetRequest({ ...dataset, groupedSettlementPeriod: undefined, Filters: [] }, current.from, current.to)
  expect(noCapability).not.toHaveProperty('groupedSettlementPeriod')
  expect(groupedSettlementRows(datasetGroupings(dataset), false).map(field => field.type)).toEqual([4, 76])
})
