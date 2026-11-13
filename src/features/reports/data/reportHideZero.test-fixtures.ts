import type { ReportDataset, ReportHideZeroCapabilities, ReportRequestBody } from '../types'
import { thresholdDataset, thresholdRequest } from './reportThreshold.test-fixtures'
import { datasetGroupings } from './reportDatasets'

export const hideZeroCapabilities: ReportHideZeroCapabilities = { Version: 1, GroupingTypes: [42], Measures: [24], MinimumNativeRowGroups: 1,
  MaximumNativeRowGroups: 1, MaximumColumnGroups: 0, MinimumActiveMeasures: 1, MaximumActiveMeasures: 1, MaximumContributions: 200000,
  OptionalGeneratedGrouping: 46, ProofGrain: 'CurrentPaymentCurrencyRegisterId', UnknownAmountsRetained: true,
  PresentationOnly: true, FactsRetainedForTotals: true, FactsRetainedForAbc: true, GlobalZeroResourceHidden: true, CompleteSourceParity: false }
export const hideZeroDataset: ReportDataset = { ...thresholdDataset, HideZero: hideZeroCapabilities }
export function hideZeroRequest(): ReportRequestBody {
  const original = thresholdRequest()
  return { ...original, hideZero: { Version: 1 }, sorted: { ...original.sorted, Row: [46, 42].map(type => datasetGroupings(hideZeroDataset).find(field => field.type === type)!) },
    threshold: { ...original.threshold as object, Grouping: 42 }, topGroups: { ...original.topGroups as object, Grouping: 42 },
    abcClassification: { ...original.abcClassification as object, Grouping: 42 },
    ordering: { Version: 1, Rows: [{ Grouping: 46, By: 1, Direction: 1, Nulls: 2 }, { Grouping: 42, By: 1, Direction: 1, Nulls: 2 }], Columns: [] } }
}
