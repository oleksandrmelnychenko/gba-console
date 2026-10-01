import type { ReportGroupingItem, ReportMeasurementGroup, ReportRequestBody, ReportSelection } from '../types'
import { flattenCheckedMeasurements } from './reportOptions'
import { reportSelectionsForRequest } from './reportFilterExpression'
import { oneCSpecialSpecification } from './oneCSpecialReports'

type BuilderValues = {
  returnsOnly?: boolean
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
  sourceBuyerSubtree?: unknown
  dayOrganizationBasis?: unknown
  supplierBasis?: unknown
  supplierSourceWorld?: unknown
  priceTypeSalesComparison?: unknown
  oneCSpecialSettings?: unknown
  oneC?: ReportRequestBody['oneC']
  valuationClientAgreementId: number | undefined
  agreementPriceComparison?: unknown
  settlementPeriod?: unknown
  groupedSettlementPeriod?: unknown
  sourceCounterpartyGroups?: unknown
  groupedCashPeriod?: unknown
  cashPeriod?: unknown
  rowGroups: ReportGroupingItem[]; colGroups: ReportGroupingItem[]
  measurements: ReportMeasurementGroup[]; selections: ReportSelection[]
}

/** Tree indices address this exact selection array; only the legacy request omits unchecked rows. */
export function buildReportBuilderRequest(values: BuilderValues): ReportRequestBody {
  const { dataSource, returnsOnly, from, to, ordering, filterExpression, topGroups, abcClassification, threshold, hideZero, comparison, xyz, revenueComparison, buyerSalesShare, returnComparison, paymentComparison, marginComparison, rateComparison, productClassification, sourceOrganizations, sourceBuyerSubtree, dayOrganizationBasis, supplierBasis, supplierSourceWorld, priceTypeSalesComparison, oneCSpecialSettings, oneC, valuationClientAgreementId, agreementPriceComparison, settlementPeriod, groupedSettlementPeriod, cashPeriod, rowGroups, colGroups, measurements, selections } = values
  const special = oneCSpecialSpecification(dataSource)
  return { dataSource, from, to, ...(returnsOnly === true ? { returnsOnly: true } : {}),
    ...(special && oneCSpecialSettings !== undefined ? { [special.key]: oneCSpecialSettings } : {}),
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
    ...(sourceBuyerSubtree !== undefined ? { sourceBuyerSubtree } : {}),
    ...(dayOrganizationBasis !== undefined ? { dayOrganizationBasis } : {}),
    ...(supplierBasis !== undefined ? { supplierBasis } : {}),
    ...(supplierSourceWorld !== undefined ? { supplierSourceWorld } : {}),
    ...(priceTypeSalesComparison !== undefined ? { priceTypeSalesComparison } : {}),
    ...(oneC !== undefined ? { oneC } : {}),
    ...(valuationClientAgreementId !== undefined ? { valuationClientAgreementId } : {}),
    ...(agreementPriceComparison !== undefined ? { agreementPriceComparison } : {}),
    ...(settlementPeriod !== undefined ? { settlementPeriod } : {}),
    ...(groupedSettlementPeriod !== undefined ? { groupedSettlementPeriod } : {}),
    ...(values.sourceCounterpartyGroups !== undefined ? { sourceCounterpartyGroups: values.sourceCounterpartyGroups } : {}),
    ...(cashPeriod !== undefined ? { cashPeriod } : {}),
    ...(values.groupedCashPeriod !== undefined ? { groupedCashPeriod: values.groupedCashPeriod } : {}),
    sorted: { Col: colGroups, Row: rowGroups, Measurements: flattenCheckedMeasurements(measurements) },
    selections: (dataSource === 15 || dataSource === 16 || dataSource === 17 || dataSource === 18 || dataSource === 19 || dataSource === 20 || dataSource === 21 || dataSource === 22 || dataSource === 27) ? selections : reportSelectionsForRequest(selections, filterExpression),
  }
}
