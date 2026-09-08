import type { ReportAbcClassification, ReportAbcClassificationCapabilities, ReportDataset, ReportOrdering } from '../types'
import { topDataset, topRequest } from './reportTopGroups.test-fixtures'
import { requestOrdering } from './reportOrdering'
export function abcCapabilities(dataset: ReportDataset): ReportAbcClassificationCapabilities {
  return { Version: 1, MaximumRules: 1, Axes: [1], GeneratedGrouping: 46,
    GroupingTypes: dataset.Groupings.flatMap(field => field.Type === 46 ? [] : [field.Type]),
    RankingMeasures: dataset.Measurements.flatMap(field => field.Type <= 12 || field.Type >= 17 && field.Type <= 24 ? [field.Type] : []),
    PercentMinimum: 0, PercentMaximum: 100, PercentScale: 0, PercentTotal: 100, Scope: 'GlobalKeyAfterTop',
    ClassBasis: 'CumulativeBeforeCurrentGroup', UnknownScores: 'Reject', NegativeScores: 'Reject', TotalsScope: 'AllRetainedFacts', TieBreak: 'TypedKeyAscending' }
}
export const abcClass = { type: 46, key: 'AbcClass', label: 'ABC-клас' }
export const abcDataset: ReportDataset = { ...topDataset, Groupings: [...topDataset.Groupings, { Type: 46, Name: 'ABC-клас' }],
  AbcClassification: abcCapabilities(topDataset), Ordering: { Version: 1, MaximumRules: 32,
    Groupings: [...topDataset.Groupings.map(field => ({ Type: field.Type, By: [1, 2, 3] })), { Type: 46, By: [1, 2, 3] }] } }
export const accountAbc: ReportAbcClassification = { Version: 1, Axis: 1, Grouping: 40, Measure: 24, PercentA: 80, PercentB: 15, PercentC: 5 }
export function abcRequest() {
  const data = topRequest(), ordering = requestOrdering(data) as ReportOrdering
  return { ...data, abcClassification: structuredClone(accountAbc), sorted: { ...data.sorted, Row: [structuredClone(abcClass), ...data.sorted.Row] },
    ordering: { ...ordering, Rows: [{ Grouping: 46, By: 1 as const, Direction: 1 as const, Nulls: 2 as const }, ...ordering.Rows] } }
}
