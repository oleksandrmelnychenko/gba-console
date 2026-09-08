import { describe, expect, it } from 'vitest'
import { abcCapabilities, abcClass, abcDataset, abcRequest, accountAbc } from './reportAbcClassification.test-fixtures'
import { defaultAbcClassification, readAbcCapabilities, readAbcClassification, reportAbcClassificationError, requestAbcClassification } from './reportAbcClassification'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { reportDatasets, valuationDataset } from './reportDatasets.test-fixtures'
import { readTopGroupsCapabilities, reportTopGroupsError } from './reportTopGroups'
import { canTransferReportGrouping, reorderReportGrouping } from './reportGroupingLayout'

describe('ABC classification contract and generated identity', () => {
  it('requires capability proof, real native target and one generated row; absent rule keeps old requests valid', () => {
    expect(datasetConfigurationError(abcRequest(), abcDataset)).toBeNull()
    const ordinary = defaultDatasetRequest(abcDataset, '', '')
    expect(ordinary.sorted.Row.some(field => field.type === 46)).toBe(false)
    expect(reportAbcClassificationError(ordinary, undefined)).toBeNull()
    const initial = defaultAbcClassification(ordinary, abcDataset)
    expect(initial).toEqual({ ...accountAbc, Grouping: ordinary.sorted.Row[0].type })
    expect(defaultAbcClassification(abcRequest(), abcDataset)).toBeNull()
    expect(defaultAbcClassification({ ...ordinary, sorted: { ...ordinary.sorted, Row: [] } }, abcDataset)).toBeNull()
    expect(reportAbcClassificationError(abcRequest(), { ...abcDataset, AbcClassification: undefined })).toContain('не підтвердив')
  })
  it.each([
    { ...accountAbc, Version: 2 }, { ...accountAbc, Axis: 2 }, { ...accountAbc, Grouping: undefined }, { ...accountAbc, Measure: undefined },
    { ...accountAbc, PercentA: undefined }, { ...accountAbc, PercentB: undefined }, { ...accountAbc, PercentC: undefined },
    { ...accountAbc, PercentA: '80' }, { ...accountAbc, PercentB: '' }, { ...accountAbc, PercentC: 5.5 },
    { ...accountAbc, Sql: 'not executed' }, { ...accountAbc, Scope: 'PerParent' },
  ])('preserves and refuses malformed imported rule %#', abcClassification => {
    const original = structuredClone(abcClassification)
    expect(readAbcClassification(abcClassification)).toBeNull()
    expect(reportAbcClassificationError({ ...abcRequest(), abcClassification }, abcDataset)).toMatch(/Невідома версія|некоректне/)
    expect(abcClassification).toEqual(original)
  })
  it.each([[80, 15, 4], [80, 15, 6], [-1, 96, 5], [101, 0, -1], [0, 0, 0]])('refuses percentages %i/%i/%i without clamping or deriving C', (PercentA, PercentB, PercentC) => {
    const data = { ...abcRequest(), abcClassification: { ...accountAbc, PercentA, PercentB, PercentC } }
    const original = structuredClone(data)
    expect(reportAbcClassificationError(data, abcDataset)).toContain('сумою 100')
    expect(data).toEqual(original)
  })
  it.each([[100, 0, 0], [0, 100, 0], [0, 0, 100], [79, 16, 5]])('accepts exact integer boundaries %i/%i/%i for server computation', (PercentA, PercentB, PercentC) => {
    expect(reportAbcClassificationError({ ...abcRequest(), abcClassification: { ...accountAbc, PercentA, PercentB, PercentC } }, abcDataset)).toBeNull()
  })
  it('preserves dual camel/Pascal aliases, including null conflicts', () => {
    const data = abcRequest()
    expect(reportAbcClassificationError({ ...data, AbcClassification: null }, abcDataset)).toContain('двічі')
    const { abcClassification, ...other } = data
    expect(requestAbcClassification({ ...other, AbcClassification: abcClassification })).toEqual(accountAbc)
    expect(reportAbcClassificationError({ ...other, AbcClassification: abcClassification }, abcDataset)).toBeNull()
    expect(requestAbcClassification({ ...data, abcClassification: undefined, AbcClassification: accountAbc })).toBeUndefined()
  })
  it('rejects absent/duplicate/generated targets and disabled measures without dropping the rule', () => {
    const data = abcRequest(), native = data.sorted.Row.find(field => field.type === 40)!
    expect(reportAbcClassificationError({ ...data, sorted: { ...data.sorted, Row: data.sorted.Row.slice(1) } }, abcDataset)).toContain('ABC-клас')
    expect(reportAbcClassificationError({ ...data, sorted: { ...data.sorted, Row: [...data.sorted.Row, abcClass] } }, abcDataset)).toContain('рівно один раз')
    const moved = { ...data, sorted: { ...data.sorted, Row: data.sorted.Row.filter(field => field.type !== 40), Col: [native] } }
    expect(reportAbcClassificationError(moved, abcDataset)).toContain('Перенесення або видалення')
    expect(moved.abcClassification).toEqual(accountAbc)
    expect(reportAbcClassificationError({ ...data, abcClassification: { ...accountAbc, Grouping: 46 } }, abcDataset)).toContain('початковий ключ')
    expect(reportAbcClassificationError({ ...data, sorted: { ...data.sorted, Measurements: [] } }, abcDataset)).toContain('увімкнений показник')
  })
  it('allows row repositioning but blocks generated class in columns, as a TOP target, or without ABC', () => {
    const data = abcRequest(), allowed = new Set(abcDataset.Groupings.map(field => field.Type))
    expect(canTransferReportGrouping(data.sorted, 'Row', 46, allowed)).toBe(false)
    const reordered = reorderReportGrouping(data.sorted.Row, 46, 1, allowed)
    expect(reordered[1]).toEqual(abcClass)
    expect(reportAbcClassificationError({ ...data, sorted: { ...data.sorted, Row: reordered } }, abcDataset)).toBeNull()
    expect(reportAbcClassificationError({ ...data, sorted: { ...data.sorted, Col: [abcClass] } }, abcDataset)).toContain('лише в рядках')
    expect(reportAbcClassificationError({ ...data, abcClassification: undefined }, abcDataset)).toContain('потребує увімкненої')
    expect(reportTopGroupsError({ ...data, topGroups: { ...data.topGroups!, Grouping: 46 } }, abcDataset)).toContain('поле має бути')
    expect(readTopGroupsCapabilities({ ...abcDataset, TopGroups: { ...abcDataset.TopGroups as object, GroupingTypes: [46] } })).toBeNull()
  })
  it.each([
    { GeneratedGrouping: 47 }, { GroupingTypes: [40, 46] }, { GroupingTypes: [999] }, { RankingMeasures: [13] }, { RankingMeasures: [16] },
    { Version: 2 }, { MaximumRules: 2 }, { Axes: [1, 2] }, { PercentScale: 2 }, { PercentTotal: 99 }, { PercentMinimum: 1 },
    { Scope: 'PerParent' }, { ClassBasis: 'CumulativeAfter' }, { UnknownScores: 'Ignore' }, { NegativeScores: 'Allow' },
    { TotalsScope: 'ClassAOnly' }, { TieBreak: 'Caption' },
  ])('rejects unsupported/tampered capability semantics %#', patch => {
    expect(readAbcCapabilities({ ...abcDataset, AbcClassification: { ...abcCapabilities(abcDataset), ...patch } })).toBeNull()
  })
  it('accepts explicit Year0/Quantity0 identities; never defaults a missing required key', () => {
    const dataset = { ...reportDatasets[0], Groupings: [...reportDatasets[0].Groupings, { Type: 46, Name: 'ABC-клас' }], AbcClassification: abcCapabilities(reportDatasets[0]) }
    const data = defaultDatasetRequest(dataset, '2026-06-01', '2026-06-30')
    data.sorted.Row = [abcClass, { type: 0, key: 'Year', label: 'Рік' }]
    expect(reportAbcClassificationError({ ...data, abcClassification: { ...accountAbc, Grouping: 0, Measure: 0 } }, dataset)).toBeNull()
  })
  it('retains exact class position, raw rules, filter tree and disabled conditions through a preset, plus valuation CA', () => {
    const data = abcRequest(), original = structuredClone(data)
    const preset = datasetPresetRequest(abcDataset, 'account-balances-by-purpose-currency', data)!
    expect(preset.Data.sorted.Row).toEqual(data.sorted.Row)
    expect(preset.Data.abcClassification).toEqual(accountAbc)
    expect(preset.Data.filterExpression).toEqual(data.filterExpression); expect(preset.Data.selections).toEqual(data.selections)
    const valuation = datasetPresetRequest(valuationDataset, 'stock-value-by-agreement', { ...data, dataSource: 8, valuationClientAgreementId: 456246 })!
    expect(valuation.Data.valuationClientAgreementId).toBe(456246); expect(valuation.Data.abcClassification).toEqual(accountAbc)
    expect(valuation.Data.sorted.Row[0]).toEqual(abcClass)
    const duplicate = datasetPresetRequest(abcDataset, 'account-balances-by-purpose-currency', { ...data, AbcClassification: { Version: 99 } })!
    expect(duplicate.Data.AbcClassification).toEqual({ Version: 99 }); expect(reportAbcClassificationError(duplicate.Data, abcDataset)).toContain('двічі')
    expect(data).toEqual(original)
  })
})
