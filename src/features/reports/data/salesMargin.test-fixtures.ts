import { SALES_MARGIN_COLUMNS, SALES_MARGIN_INPUT_BASIS, SALES_MARGIN_PRESENTATION_BASIS, SALES_MARGIN_SOURCE,
  SALES_MARGIN_TITLE, salesMarginPeriods, type SalesMarginCapabilities, type SalesMarginInput, type SalesMarginReport } from './salesMargin'
import type { ReportCatalogueEntry } from '../types'

export function salesMarginCapability(): SalesMarginCapabilities {
  return { Version: 1, SourceIdentity: { ...SALES_MARGIN_SOURCE }, Title: SALES_MARGIN_TITLE, Executable: true,
    Periodicity: 'Month', PreviousMonthOffset: -1, Columns: SALES_MARGIN_COLUMNS.map(column => ({ ...column })), Filters: [],
    InputBasis: SALES_MARGIN_INPUT_BASIS, PresentationBasis: SALES_MARGIN_PRESENTATION_BASIS, Currency: 'EUR',
    IncludesPostedSaleAndReturnLines: true, EffectiveSourcePeriodsVerified: false, SourceParityVerified: false, MaximumFacts: 200000 }
}
export function salesMarginInput(sales = '100', cost = '40'): SalesMarginInput {
  return { SaleLines: 1, ReturnLines: 0, UnknownSalesLines: 0, CostGroups: 1, UnknownCostGroups: 0,
    SalesEur: { Numerator: sales, Denominator: '1' }, CostEur: { Numerator: cost, Denominator: '1' }, Available: true }
}
export function salesMarginEmptyInput(): SalesMarginInput {
  return { ...salesMarginInput('0', '0'), SaleLines: 0, CostGroups: 0 }
}
export function salesMarginReport(month = '2026-09'): SalesMarginReport {
  const values = ['0.6', '0.5', '20', '0.1'], formatted = ['0.6', '0.5', '20.00', '0.10']
  return { Version: 1, SourceIdentity: { ...SALES_MARGIN_SOURCE }, Month: month, ...salesMarginPeriods(month),
    Columns: SALES_MARGIN_COLUMNS.map(column => ({ ...column })),
    Cells: SALES_MARGIN_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], FormattedValue: formatted[index], Available: true })),
    Inputs: { Current: salesMarginInput(), Previous: salesMarginInput('100', '50') }, Complete: true, HasRows: true, Code: 'available',
    InputBasis: SALES_MARGIN_INPUT_BASIS, PresentationBasis: SALES_MARGIN_PRESENTATION_BASIS, Currency: 'EUR',
    EffectiveSourcePeriodsVerified: false, SourceParityVerified: false,
    ObservationStartedAtUtc: '2026-10-02T01:00:00Z', ObservationCompletedAtUtc: '2026-10-02T01:00:01Z',
    RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    DocumentURL: '/files/sales-margin.xlsx', PdfDocumentURL: '/files/sales-margin.pdf' }
}
export function salesMarginCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${SALES_MARGIN_SOURCE.SourceId}`, Name: SALES_MARGIN_TITLE, Title: SALES_MARGIN_TITLE, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: SALES_MARGIN_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
