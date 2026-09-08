import type { ReportGroupingItem, ReportMeasurementGroup, ReportRequestBody, ReportSelection } from '../types'
import { flattenCheckedMeasurements } from './reportOptions'
import { reportSelectionsForRequest } from './reportFilterExpression'

type BuilderValues = {
  dataSource: number; from: string; to: string; ordering: unknown; filterExpression: unknown; topGroups: unknown
  abcClassification?: unknown
  comparison?: unknown
  hideZero?: unknown
  threshold?: unknown
  valuationClientAgreementId: number | undefined
  rowGroups: ReportGroupingItem[]; colGroups: ReportGroupingItem[]
  measurements: ReportMeasurementGroup[]; selections: ReportSelection[]
}

/** Tree indices address this exact selection array; only the legacy request omits unchecked rows. */
export function buildReportBuilderRequest(values: BuilderValues): ReportRequestBody {
  const { dataSource, from, to, ordering, filterExpression, topGroups, abcClassification, threshold, hideZero, comparison, valuationClientAgreementId, rowGroups, colGroups, measurements, selections } = values
  return { dataSource, from, to,
    ...(comparison !== undefined ? { comparison } : {}),
    ...(ordering !== undefined ? { ordering } : {}),
    ...(filterExpression !== undefined ? { filterExpression } : {}),
    ...(abcClassification !== undefined ? { abcClassification } : {}),
    ...(hideZero !== undefined ? { hideZero } : {}),
    ...(threshold !== undefined ? { threshold } : {}),
    ...(topGroups !== undefined ? { topGroups } : {}),
    ...(valuationClientAgreementId !== undefined ? { valuationClientAgreementId } : {}),
    sorted: { Col: colGroups, Row: rowGroups, Measurements: flattenCheckedMeasurements(measurements) },
    selections: reportSelectionsForRequest(selections, filterExpression),
  }
}
