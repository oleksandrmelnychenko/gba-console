import { ORIGINAL_BUYER_SALES_SHARE_COLUMNS, ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS, originalBuyerSalesSharePeriods,
  type OriginalBuyerSalesShareCapabilities, type OriginalBuyerSalesShareReport, type OriginalBuyerSalesShareVariant } from './originalBuyerSalesShare'
import type { ReportCatalogueEntry } from '../types'
export function originalBuyerSalesShareCapability(variant: OriginalBuyerSalesShareVariant = 'new'): OriginalBuyerSalesShareCapabilities {
  const definition = ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[variant]
  return { Version: 1, SourceIdentity: { ...definition.SourceIdentity }, Title: definition.Title, Executable: true,
    Periodicity: 'Month', PreviousMonthOffset: -1, Columns: ORIGINAL_BUYER_SALES_SHARE_COLUMNS.map(column => ({ ...column })), Filters: [],
    InputBasis: 'CurrentOurRecordedNetEur', IdentityBasis: 'CurrentOurClient', HistoryBasis: 'AllPriorCurrentOurSaleAndReturnActivity',
    Currency: 'EUR', IncludesPostedSaleAndReturnLines: true, BaseFractionIsPercent: false, SourceParityVerified: false, RawFractionalPlaces: 28 }
}
export function originalBuyerSalesShareReport(month = '2026-09', variant: OriginalBuyerSalesShareVariant = 'new'): OriginalBuyerSalesShareReport {
  const capability = originalBuyerSalesShareCapability(variant), values = ['0.25', '0.5', '-50', '-0.25']
  const input = (numerator: string, fraction: string) => ({ SaleLines: 3, ReturnLines: 1, UnknownMoneyLines: 0,
    UnknownClientLines: 0, UnknownHistoryLines: 0, DenominatorNetEur: '200', NumeratorNetEur: numerator,
    RawFraction: fraction, FractionIsZero: false, Available: true, Code: 'available' as const })
  const cells = ORIGINAL_BUYER_SALES_SHARE_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], Available: true }))
  return { ...capability, Month: month, ...originalBuyerSalesSharePeriods(month), Cells: cells, TotalCells: cells.map(cell => ({ ...cell })),
    Inputs: { Current: input('50', '0.25'), Previous: input('100', '0.5') },
    ObservationStartedAtUtc: '2026-10-01T10:00:00.1234567Z', ObservationCompletedAtUtc: '2026-10-01T10:00:00.1244567Z',
    RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    DocumentURL: `/files/${variant}-buyer-share.xlsx`, PdfDocumentURL: `/files/${variant}-buyer-share.pdf` }
}
export function originalBuyerSalesShareCatalogueEntry(variant: OriginalBuyerSalesShareVariant = 'new'): ReportCatalogueEntry {
  const definition = ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[variant]
  return { Id: `custom:fenix:${definition.SourceIdentity.SourceId}`, Name: definition.Title, Title: definition.Title, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: definition.SourceIdentity.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
