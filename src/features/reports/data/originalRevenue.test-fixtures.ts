import type { ReportCatalogueEntry } from '../types'
import { ORIGINAL_REVENUE_COLUMNS, ORIGINAL_REVENUE_SOURCE, ORIGINAL_REVENUE_TITLE, originalRevenuePeriods,
  type OriginalRevenueCapabilities, type OriginalRevenueCell, type OriginalRevenueInput, type OriginalRevenueReport } from './originalRevenue'

export function originalRevenueCapability(): OriginalRevenueCapabilities {
  return { Version: 1, SourceIdentity: { ...ORIGINAL_REVENUE_SOURCE }, Title: ORIGINAL_REVENUE_TITLE, Executable: true,
    Periodicity: 'Month', PreviousMonthOffset: -1, RowCaption: 'Контрагент', Columns: ORIGINAL_REVENUE_COLUMNS.map(column => ({ ...column })),
    Filters: [], InputBasis: 'CurrentOurRecordedGrossEur', IdentityBasis: 'CurrentOurClient', Currency: 'EUR',
    IncludesPostedSaleAndReturnLines: true, SourceParityVerified: false }
}
export function originalRevenueInput(gross: string | null, sales = 1, returns = 0): OriginalRevenueInput {
  return { SaleLines: sales, ReturnLines: returns, UnknownMoneyLines: gross === null ? 1 : 0, GrossEur: gross }
}
export function originalRevenueCells(values: Array<string | null>): OriginalRevenueCell[] {
  return ORIGINAL_REVENUE_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], Available: values[index] !== null }))
}
export function originalRevenueReport(month = '2026-09'): OriginalRevenueReport {
  return { Version: 1, SourceIdentity: { ...ORIGINAL_REVENUE_SOURCE }, Month: month, ...originalRevenuePeriods(month), RowCaption: 'Контрагент',
    Columns: ORIGINAL_REVENUE_COLUMNS.map(column => ({ ...column })), Rows: [
      { ClientId: '9007199254740993', Caption: 'Покупець', Attributed: true, Current: originalRevenueInput('150', 2, 1),
        Previous: originalRevenueInput('75'), Cells: originalRevenueCells(['150', '75', '100', '75']) },
      { ClientId: null, Caption: 'Контрагент не определён', Attributed: false, Current: originalRevenueInput('60'),
        Previous: originalRevenueInput('50'), Cells: originalRevenueCells(['60', '50', '20', '10']) },
    ], Totals: { Current: originalRevenueInput('210', 3, 1), Previous: originalRevenueInput('125', 2),
      Cells: originalRevenueCells(['210', '125', '68', '85']) },
    InputBasis: 'CurrentOurRecordedGrossEur', IdentityBasis: 'CurrentOurClient', Currency: 'EUR',
    IncludesPostedSaleAndReturnLines: true, SourceParityVerified: false,
    ObservationStartedAtUtc: '2026-10-01T12:00:00.1234567Z', ObservationCompletedAtUtc: '2026-10-01T12:00:00.1244567Z',
    RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), DocumentURL: '/files/original-revenue.xlsx', PdfDocumentURL: '/files/original-revenue.pdf' }
}
export function originalRevenueCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${ORIGINAL_REVENUE_SOURCE.SourceId}`, Name: ORIGINAL_REVENUE_TITLE, Title: ORIGINAL_REVENUE_TITLE, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: ORIGINAL_REVENUE_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
