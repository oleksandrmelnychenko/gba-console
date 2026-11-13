import type { ReportGroupingItem, ReportMeasurementGroup, ReportRequestBody, ReportSelection } from '../types'
import { flattenCheckedMeasurements } from './reportOptions'
import { reportSelectionsForRequest } from './reportFilterExpression'

type BuilderValues = {
  presentationCurrency?: unknown
  reportProfile?: unknown
  stockQuantityFilter?: unknown
  constructorPresentation?: unknown
  numberPresentation?: unknown
  supplierWarehouse?: unknown
  returnsOnly?: boolean
  dataSource: number; from: string; to: string; ordering: unknown; filterExpression: unknown; topGroups: unknown
  abcClassification?: unknown
  hideZero?: unknown
  threshold?: unknown
  productClassification?: unknown
  productServiceFilter?: unknown
  sourceOrganizations?: unknown
  sourceBuyerSubtree?: unknown
  profitReadMode?: unknown
  settlementReadMode?: unknown
  cashReadMode?: unknown
  dayOrganizationBasis?: unknown
  supplierBasis?: unknown
  supplierSourceWorld?: unknown
  oneC?: ReportRequestBody['oneC']
  settlementPeriod?: unknown
  groupedSettlementPeriod?: unknown
  sourceCounterpartyGroups?: unknown
  groupedCashPeriod?: unknown
  cashPeriod?: unknown
  workbookPresentation?: unknown
  rowGroups: ReportGroupingItem[]; colGroups: ReportGroupingItem[]
  measurements: ReportMeasurementGroup[]; selections: ReportSelection[]
}

/** Tree indices address this exact selection array; only the legacy request omits unchecked rows. */
export function buildReportBuilderRequest(values: BuilderValues): ReportRequestBody {
  const { dataSource, returnsOnly, from, to, ordering, filterExpression, topGroups, abcClassification, threshold, hideZero, productClassification, sourceOrganizations, sourceBuyerSubtree, dayOrganizationBasis, supplierBasis, supplierSourceWorld, oneC, settlementPeriod, groupedSettlementPeriod, cashPeriod, rowGroups, colGroups, measurements, selections } = values
  return { dataSource, from, to, ...(values.stockQuantityFilter != null ? { stockQuantityFilter: values.stockQuantityFilter } : {}), ...(values.constructorPresentation !== undefined ? { constructorPresentation: values.constructorPresentation } : {}), ...(values.reportProfile !== undefined ? { reportProfile: values.reportProfile } : {}), ...(values.presentationCurrency !== undefined ? { presentationCurrency: values.presentationCurrency } : {}), ...(values.supplierWarehouse !== undefined ? { supplierWarehouse: values.supplierWarehouse } : {}), ...(values.numberPresentation !== undefined ? { numberPresentation: values.numberPresentation } : {}), ...(returnsOnly === true ? { returnsOnly: true } : {}),
    ...(ordering !== undefined ? { ordering } : {}),
    ...(filterExpression !== undefined ? { filterExpression } : {}),
    ...(abcClassification !== undefined ? { abcClassification } : {}),
    ...(hideZero !== undefined ? { hideZero } : {}),
    ...(threshold !== undefined ? { threshold } : {}),
    ...(topGroups !== undefined ? { topGroups } : {}),
    ...(productClassification !== undefined ? { productClassification } : {}),
    ...(values.productServiceFilter !== undefined ? { productServiceFilter: values.productServiceFilter } : {}),
    ...(sourceOrganizations !== undefined ? { sourceOrganizations } : {}),
    ...(sourceBuyerSubtree !== undefined ? { sourceBuyerSubtree } : {}),
    ...(values.profitReadMode !== undefined ? { profitReadMode: values.profitReadMode } : {}),
    ...(values.settlementReadMode !== undefined ? { settlementReadMode: values.settlementReadMode } : {}),
    ...(values.cashReadMode !== undefined ? { cashReadMode: values.cashReadMode } : {}),
    ...(dayOrganizationBasis !== undefined ? { dayOrganizationBasis } : {}),
    ...(supplierBasis !== undefined ? { supplierBasis } : {}),
    ...(supplierSourceWorld !== undefined ? { supplierSourceWorld } : {}),
    ...(oneC !== undefined ? { oneC } : {}),
    ...(settlementPeriod !== undefined ? { settlementPeriod } : {}),
    ...(groupedSettlementPeriod !== undefined ? { groupedSettlementPeriod } : {}),
    ...(values.sourceCounterpartyGroups !== undefined ? { sourceCounterpartyGroups: values.sourceCounterpartyGroups } : {}),
    ...(cashPeriod !== undefined ? { cashPeriod } : {}),
    ...(values.groupedCashPeriod !== undefined ? { groupedCashPeriod: values.groupedCashPeriod } : {}),
    ...(values.workbookPresentation !== undefined ? { workbookPresentation: values.workbookPresentation } : {}),
    sorted: { Col: colGroups, Row: rowGroups, Measurements: flattenCheckedMeasurements(measurements) },
    selections: reportSelectionsForRequest(selections, filterExpression),
  }
}
