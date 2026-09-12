import type { ReportGroupingItem, ReportMeasurementGroup, ReportRequestBody, ReportSelection } from '../types'
import { flattenCheckedMeasurements } from './reportOptions'
import { reportSelectionsForRequest } from './reportFilterExpression'

type BuilderValues = {
  dataSource: number; from: string; to: string; ordering: unknown; filterExpression: unknown; topGroups: unknown
  abcClassification?: unknown
  paymentComparison?: unknown
  marginComparison?: unknown
  rateComparison?: unknown
  returnComparison?: unknown
  buyerSalesShare?: unknown
  revenueComparison?: unknown
  xyz?: unknown
  comparison?: unknown
  hideZero?: unknown
  threshold?: unknown
  productClassification?: unknown
  sourceOrganizations?: unknown
  valuationClientAgreementId: number | undefined
  rowGroups: ReportGroupingItem[]; colGroups: ReportGroupingItem[]
  measurements: ReportMeasurementGroup[]; selections: ReportSelection[]
}

/** Tree indices address this exact selection array; only the legacy request omits unchecked rows. */
export function buildReportBuilderRequest(values: BuilderValues): ReportRequestBody {
  const { dataSource, from, to, ordering, filterExpression, topGroups, abcClassification, threshold, hideZero, comparison, xyz, revenueComparison, buyerSalesShare, returnComparison, paymentComparison, marginComparison, rateComparison, productClassification, sourceOrganizations, valuationClientAgreementId, rowGroups, colGroups, measurements, selections } = values
  return { dataSource, from, to,
    ...(paymentComparison !== undefined ? { paymentComparison } : {}),
    ...(marginComparison !== undefined ? { marginComparison } : {}),
    ...(rateComparison !== undefined ? { rateComparison } : {}),
    ...(returnComparison !== undefined ? { returnComparison } : {}),
    ...(buyerSalesShare !== undefined ? { buyerSalesShare } : {}),
    ...(revenueComparison !== undefined ? { revenueComparison } : {}),
    ...(xyz !== undefined ? { xyz } : {}),
    ...(comparison !== undefined ? { comparison } : {}),
    ...(ordering !== undefined ? { ordering } : {}),
    ...(filterExpression !== undefined ? { filterExpression } : {}),
    ...(abcClassification !== undefined ? { abcClassification } : {}),
    ...(hideZero !== undefined ? { hideZero } : {}),
    ...(threshold !== undefined ? { threshold } : {}),
    ...(topGroups !== undefined ? { topGroups } : {}),
    ...(productClassification !== undefined ? { productClassification } : {}),
    ...(sourceOrganizations !== undefined ? { sourceOrganizations } : {}),
    ...(valuationClientAgreementId !== undefined ? { valuationClientAgreementId } : {}),
    sorted: { Col: colGroups, Row: rowGroups, Measurements: flattenCheckedMeasurements(measurements) },
    selections: (dataSource === 15 || dataSource === 16 || dataSource === 17 || dataSource === 18 || dataSource === 19 || dataSource === 20 || dataSource === 21 || dataSource === 22) ? selections : reportSelectionsForRequest(selections, filterExpression),
  }
}
