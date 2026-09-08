import type { ReportDataset, ReportRequestBody, ReportThreshold, ReportThresholdCapabilities } from '../types'
import { abcDataset, abcRequest } from './reportAbcClassification.test-fixtures'

export function thresholdCapabilities(dataset: ReportDataset): ReportThresholdCapabilities {
  return { Version: 1, MaximumRules: 1, Axes: [1], PercentMinimum: 1, PercentMaximum: 100, PercentScale: 0,
    MaximumNativeRowGroupings: 1, MaximumNativeColumnGroupings: 0, MaximumActiveMeasures: 1,
    GroupingTypes: dataset.Groupings.flatMap(field => field.Type === 46 ? [] : [field.Type]),
    RankingMeasures: dataset.Measurements.flatMap(field => field.Type <= 12 || field.Type >= 17 && field.Type <= 24 ? [field.Type] : []),
    Scope: 'GlobalKeyAfterTop', TotalsScope: 'AllInputFactsIncludingOther', UnknownScores: 'Reject', NegativeScores: 'Reject',
    NonPositiveTotal: 'RejectExceptEmpty', ZeroOnlyRemainder: 'Reject', OtherIdentityKind: 'ThresholdOther', SyntheticOtherSelectable: false,
    MaximumContributions: 200000, SupportsAbc: true, SupportsTop: true, SupportsOrdering: true }
}
export const thresholdDataset: ReportDataset = { ...abcDataset, Threshold: thresholdCapabilities(abcDataset) }
export const accountThreshold: ReportThreshold = { Version: 1, Axis: 1, Grouping: 40, Measure: 24, Percent: 20 }
export function thresholdRequest(): ReportRequestBody {
  const data = abcRequest()
  return { ...data, threshold: structuredClone(accountThreshold), sorted: { ...data.sorted, Row: data.sorted.Row.filter(field => field.type === 46 || field.type === 40) } }
}
