import { describe, expect, it } from 'vitest'
import { accountTop, topCapabilities, topDataset, topRequest } from './reportTopGroups.test-fixtures'
import { defaultReportTopGroups, readReportTopGroups, readTopGroupsCapabilities, reportTopGroupsError, requestTopGroups } from './reportTopGroups'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { reportDatasets, valuationDataset } from './reportDatasets.test-fixtures'

describe('whole-group TOP request and capability guards', () => {
  it('uses only a chosen row grouping and an active additive measure; absent rule keeps legacy compatibility', () => {
    expect(datasetConfigurationError(topRequest(), topDataset)).toBeNull()
    expect(reportTopGroupsError({ ...topRequest(), topGroups: undefined }, undefined)).toBeNull()
    expect(reportTopGroupsError(topRequest(), { ...topDataset, TopGroups: undefined })).toContain('не підтвердив')
    const data = topRequest(), selected = defaultReportTopGroups(data, topDataset)
    expect(selected?.Grouping).toBe(data.sorted.Row[0].type); expect(selected?.Measure).toBe(24)
    expect(defaultReportTopGroups({ ...data, sorted: { ...data.sorted, Row: [] } }, topDataset)).toBeNull()
    expect(defaultReportTopGroups({ ...data, sorted: { ...data.sorted, Measurements: [] } }, topDataset)).toBeNull()
  })
  it.each([
    { ...accountTop, Version: 2 }, { ...accountTop, Axis: 2 }, { ...accountTop, Mode: 0 }, { ...accountTop, Direction: 0 },
    { ...accountTop, Value: 1.5 }, { ...accountTop, Value: '10' }, { ...accountTop, Value: '' }, { ...accountTop, Grouping: undefined },
    { ...accountTop, Measure: undefined }, { ...accountTop, Direction: undefined }, { ...accountTop, Sql: 'not executed' }, { ...accountTop, Scope: 'PerParent' },
  ])('refuses malformed and future payloads intact %#', topGroups => {
    const original = structuredClone(topGroups)
    expect(readReportTopGroups(topGroups)).toBeNull()
    expect(reportTopGroupsError({ ...topRequest(), topGroups }, topDataset)).toMatch(/Невідома версія|некоректні/)
    expect(topGroups).toEqual(original)
  })
  it.each([[1, 0], [1, -1], [1, 10001], [2, 0], [2, 101]])('refuses out-of-range mode%s/value%s without clamping', (Mode, Value) => {
    const data = { ...topRequest(), topGroups: { ...accountTop, Mode, Value } }
    expect(reportTopGroupsError(data, topDataset)).toContain('Значення не змінено автоматично')
    expect(data.topGroups.Value).toBe(Value)
  })
  it.each([[1, 1], [1, 10000], [2, 1], [2, 100]])('accepts integer boundary mode%s/value%s', (Mode, Value) => {
    expect(reportTopGroupsError({ ...topRequest(), topGroups: { ...accountTop, Mode, Value } }, topDataset)).toBeNull()
  })
  it('retains both aliases and refuses duplicates even when one is null', () => {
    const data = topRequest()
    expect(reportTopGroupsError({ ...data, TopGroups: null }, topDataset)).toContain('двічі')
    expect(requestTopGroups({ ...data, topGroups: undefined, TopGroups: accountTop })).toBeUndefined()
    const { topGroups, ...rest } = data
    expect(requestTopGroups({ ...rest, TopGroups: topGroups })).toEqual(accountTop)
    expect(reportTopGroupsError({ ...rest, TopGroups: topGroups }, topDataset)).toBeNull()
  })
  it('keeps exact TOP identity when its field moves to columns, disappears or appears twice, and when its measure is disabled', () => {
    const data = topRequest(), group = data.sorted.Row.find(field => field.type === 40)!
    const moved = { ...data, sorted: { ...data.sorted, Row: data.sorted.Row.filter(field => field.type !== 40), Col: [group] } }
    expect(reportTopGroupsError(moved, topDataset)).toContain('перенесення до стовпців його не вимикає')
    expect(moved.topGroups).toEqual(accountTop)
    expect(reportTopGroupsError({ ...data, sorted: { ...data.sorted, Row: [...data.sorted.Row, group] } }, topDataset)).toContain('рівно один раз')
    const disabled = { ...data, sorted: { ...data.sorted, Measurements: data.sorted.Measurements.map(field => ({ ...field, IsChecked: false })) } }
    expect(reportTopGroupsError(disabled, topDataset)).toContain('увімкнений показник')
    expect(disabled.topGroups).toEqual(accountTop)
  })
  it.each([13, 14, 15, 16])('cannot rank ratio/distinct measure%s even if a tampered capability advertises it', Measure => {
    const dataset = { ...topDataset, Measurements: [...topDataset.Measurements, { Type: Measure, Name: 'Other' }] }
    dataset.TopGroups = { ...topCapabilities(dataset), RankingMeasures: [24, Measure] }
    expect(readTopGroupsCapabilities(dataset)).toBeNull()
    expect(reportTopGroupsError({ ...topRequest(), topGroups: { ...accountTop, Measure } }, dataset)).not.toBeNull()
  })
  it.each([{ Scope: 'PerParent' }, { UnknownScores: 'Ignore' }, { TotalsScope: 'BeforeTop' }, { MaximumRules: 2 }, { Axes: [1, 2] }, { PercentScale: 2 }, { GroupingTypes: [999] }, { RankingMeasures: [24, 24] }])('refuses unsupported capability semantics %#', patch => {
    expect(readTopGroupsCapabilities({ ...topDataset, TopGroups: { ...topCapabilities(topDataset), ...patch } })).toBeNull()
  })
  it('accepts grouping0/measure0 explicitly without defaulting a missing required field', () => {
    const source = reportDatasets[0], dataset = { ...source, TopGroups: topCapabilities(source) }, data = defaultDatasetRequest(dataset, '2026-06-01', '2026-06-30')
    data.sorted.Row = [{ type: 0, key: 'Year', label: 'Рік' }]
    expect(reportTopGroupsError({ ...data, topGroups: { ...accountTop, Grouping: 0, Measure: 0 } }, dataset)).toBeNull()
  })
  it('keeps TOP alongside raw filter logic, disabled conditions, valuation identity and all display measures in a preset', () => {
    const data = topRequest(), preset = datasetPresetRequest(topDataset, 'account-balances-by-purpose-currency', data)!
    expect(preset.Data.topGroups).toEqual(accountTop); expect(preset.Data.filterExpression).toEqual(data.filterExpression)
    expect(preset.Data.selections).toEqual(data.selections); expect(preset.Data.sorted.Measurements).toEqual(data.sorted.Measurements)
    const valuation = datasetPresetRequest(valuationDataset, 'stock-value-by-agreement', { ...data, dataSource: 8, valuationClientAgreementId: 456246 })!
    expect(valuation.Data.valuationClientAgreementId).toBe(456246); expect(valuation.Data.topGroups).toEqual(accountTop)
    // A now-unsupported old identity is retained for validation rather than replaced with a new group/measure.
    expect(reportTopGroupsError(valuation.Data, { ...valuationDataset, TopGroups: topCapabilities(valuationDataset) })).toContain('поле має бути вибране')
    const duplicate = datasetPresetRequest(topDataset, 'account-balances-by-purpose-currency', { ...data, TopGroups: { Version: 99 } })!
    expect(duplicate.Data.TopGroups).toEqual({ Version: 99 }); expect(reportTopGroupsError(duplicate.Data, topDataset)).toContain('двічі')
  })
})
