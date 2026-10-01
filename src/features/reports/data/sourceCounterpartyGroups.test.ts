import { expect, it } from 'vitest'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { groupedSettlementDataset, groupedSettlementRequest } from './groupedSettlementPeriod.test-fixtures'
import { datasetConfigurationError, datasetMeasurements, datasetPresetRequest, datasetPresets } from './reportDatasets'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { settlementPeriodRequest } from './settlementPeriod.test-fixtures'
import { groupCapability, groupDataset, groupId, groupSelection } from './sourceCounterpartyGroups.test-fixtures'
import { changeCounterpartyGroupList, cloneSourceCounterpartyGroupAliases, counterpartyGroupId,
  normalizeSourceCounterpartyGroupDataset, requestSourceCounterpartyGroups, sourceCounterpartyGroupCapability,
  sourceCounterpartyGroups } from './sourceCounterpartyGroups'

it('admits only the exact optional current-group capability and original source identities', () => {
  expect(sourceCounterpartyGroupCapability(groupCapability)).toBe(true)
  expect(normalizeSourceCounterpartyGroupDataset(groupDataset)).toEqual(groupDataset)
  expect(normalizeSourceCounterpartyGroupDataset({ ...groupDataset, SourceCounterpartyGroups: groupCapability })).toBeNull()
  expect(normalizeSourceCounterpartyGroupDataset({ ...groupDataset, DataSource: 38 })).toBeNull()
  expect(normalizeSourceCounterpartyGroupDataset({ ...groupDataset, groupedSettlementPeriod: undefined })).toBeNull()
  for (const patch of [{ version: 1 }, { SourceWorld: 'amg' }, { UsesCurrentCapturedHierarchy: false }, { ExclusionsTakePrecedence: false }])
    expect(sourceCounterpartyGroupCapability({ ...groupCapability, ...patch })).toBe(false)
  expect(counterpartyGroupId(groupId(0))).toBe(false)
  expect(counterpartyGroupId('9007199254740993')).toBe(false)
  expect(sourceCounterpartyGroups(groupSelection)).toEqual(groupSelection)
  expect(sourceCounterpartyGroups({ ...groupSelection, IncludeGroupIds: [groupId(1), groupId(1).toLowerCase()] })).toBeNull()
  expect(sourceCounterpartyGroups({ ...groupSelection, IncludeGroupIds: Array.from({ length: 64 }, (_, i) => groupId(i + 1)) })).toBeNull()
})

it('binds include/exclude group choices to current Fenix grouped scope and refuses legacy, AMG and aliases', () => {
  const current = { ...groupedSettlementRequest(), sourceCounterpartyGroups: groupSelection }
  expect(datasetConfigurationError(current, groupDataset)).toBeNull()
  expect(datasetConfigurationError(current, groupedSettlementDataset)).toContain('Сервер')
  expect(datasetConfigurationError({ ...current, SourceCounterpartyGroups: groupSelection }, groupDataset)).toContain('двічі')
  expect(datasetConfigurationError({ ...settlementPeriodRequest(), sourceCounterpartyGroups: groupSelection }, groupDataset)).toContain('Fenix')
  expect(datasetConfigurationError({ ...current, groupedSettlementPeriod: { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' },
    sourceBuyerSubtree: undefined }, groupDataset)).toContain('Fenix')
})

it('preserves both independent lists through template aliases, layout presets, managed drafts and request capture', () => {
  const current = { ...groupedSettlementRequest(), sourceCounterpartyGroups: groupSelection }
  const saved = normalizeSavedTemplate({ Id: crypto.randomUUID(), Revision: 1, UpdatedAtUtc: '2026-09-13T00:00:00Z', Name: 'Groups',
    Data: { DataSource: 41, From: current.from, To: current.to, Sorted: current.sorted, Selections: [],
      GroupedSettlementPeriod: current.groupedSettlementPeriod, SourceBuyerSubtree: current.sourceBuyerSubtree,
      SourceCounterpartyGroups: groupSelection } })
  expect(requestSourceCounterpartyGroups(saved.Data)).toEqual(groupSelection)
  expect(cloneSourceCounterpartyGroupAliases(saved.Data).SourceCounterpartyGroups).not.toBe(groupSelection)
  const preset = datasetPresetRequest(groupDataset, datasetPresets(groupDataset)[0].id, saved.Data)!
  expect(requestSourceCounterpartyGroups(preset.Data)).toEqual(groupSelection)
  expect(datasetConfigurationError(preset.Data, groupDataset)).toBeNull()
  const built = buildReportBuilderRequest({ dataSource: 41, from: current.from, to: current.to,
    groupedSettlementPeriod: current.groupedSettlementPeriod, sourceBuyerSubtree: current.sourceBuyerSubtree,
    sourceCounterpartyGroups: groupSelection, ordering: undefined, filterExpression: undefined, topGroups: undefined,
    valuationClientAgreementId: undefined, rowGroups: current.sorted.Row, colGroups: [],
    measurements: datasetMeasurements(groupDataset, current.sorted.Measurements), selections: [] })
  expect(built).toEqual(current)
  const draft = retainStoredTemplateFields({ ...saved.Data, SOURCECOUNTERPARTYGROUPS: null } as never, built)
  expect(draft).not.toHaveProperty('SOURCECOUNTERPARTYGROUPS'); expect(draft).not.toHaveProperty('SourceCounterpartyGroups')
  expect(draft.sourceCounterpartyGroups).toEqual(groupSelection)
  expect(JSON.stringify(built)).not.toBe(JSON.stringify({ ...built, sourceCounterpartyGroups: changeCounterpartyGroupList(groupSelection, 'ExcludeGroupIds', []) }))
})

it('changes one list explicitly and clears the selector after the last group is removed', () => {
  expect(changeCounterpartyGroupList(groupSelection, 'IncludeGroupIds', [groupId(3)])).toEqual({ ...groupSelection, IncludeGroupIds: [groupId(3)] })
  expect(changeCounterpartyGroupList({ ...groupSelection, IncludeGroupIds: [] }, 'ExcludeGroupIds', [])).toBeUndefined()
})
