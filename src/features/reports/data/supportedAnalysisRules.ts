import type { ReportDataset, ReportRequestBody } from '../types'
import { readAbcCapabilities, requestAbcClassification } from './reportAbcClassification'
import { readFilterExpressionCapabilities, requestFilterExpression } from './reportFilterExpression'
import { readOrderingCapabilities, requestOrdering } from './reportOrdering'
import { readThresholdCapabilities, requestThreshold } from './reportThreshold'
import { readTopGroupsCapabilities, requestTopGroups } from './reportTopGroups'

export type SupportedAnalysisRules = { topGroups: boolean; threshold: boolean; abc: boolean; ordering: boolean; filterExpression: boolean }

export function supportedAnalysisRules(data: ReportRequestBody, dataset?: ReportDataset, filterDataset?: ReportDataset): SupportedAnalysisRules {
  return {
    topGroups: requestTopGroups(data) != null || readTopGroupsCapabilities(dataset) != null,
    threshold: requestThreshold(data) != null || readThresholdCapabilities(dataset) != null,
    abc: requestAbcClassification(data) != null || readAbcCapabilities(dataset) != null,
    ordering: requestOrdering(data) != null || readOrderingCapabilities(dataset) != null,
    filterExpression: requestFilterExpression(data) != null || readFilterExpressionCapabilities(filterDataset ?? dataset) != null,
  }
}
