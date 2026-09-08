import type { ReportDataset, ReportTopGroups, ReportTopGroupsCapabilities } from '../types'
import { expressionDataset, expressionRequest } from './reportFilterExpression.test-fixtures'

export function topCapabilities(dataset: ReportDataset): ReportTopGroupsCapabilities {
  return { Version: 1, MaximumRules: 1, Axes: [1], Modes: [1, 2], MaximumCount: 10000,
    PercentMinimum: 1, PercentMaximum: 100, PercentScale: 0, Directions: [1, 2], Scope: 'GlobalKey', TotalsScope: 'RetainedFactsOnly', UnknownScores: 'Reject',
    GroupingTypes: dataset.Groupings.map(field => field.Type), RankingMeasures: dataset.Measurements.flatMap(field => field.Type <= 12 || field.Type >= 17 && field.Type <= 24 ? [field.Type] : []) }
}
export const topDataset: ReportDataset = { ...expressionDataset, TopGroups: topCapabilities(expressionDataset) }
export const accountTop: ReportTopGroups = { Version: 1, Axis: 1, Grouping: 40, Mode: 1, Value: 10, Measure: 24, Direction: 2 }
export function topRequest() { return { ...expressionRequest(), topGroups: structuredClone(accountTop) } }
