import { MANAGEMENT_RETURNS_COLUMNS, MANAGEMENT_RETURNS_NAME, MANAGEMENT_RETURNS_SOURCE, initialManagementReturnsWindows,
  type ManagementReturnsCapabilities, type ManagementReturnsCell, type ManagementReturnsReport } from './managementReturns'
import type { ReportCatalogueEntry } from '../types'

export const MANAGEMENT_RETURNS_TEST_CALLER = '11111111-1111-1111-1111-111111111111'
export function managementReturnsCapability(): ManagementReturnsCapabilities {
  return { Version: 1, SourceIdentity: { ...MANAGEMENT_RETURNS_SOURCE }, ReportName: MANAGEMENT_RETURNS_NAME,
    DefaultPeriodicity: 'Month', ScopeKind: 'TwoExplicitHalfOpenCurrentGbaCalendarWindows',
    Grouping: 'Контрагент', ManagementCurrency: 'Управлінська валюта', InputBasis: 'NormalFenixSales22',
    RawVisibilityPolicy: 'DirectRegisterNoActivePredicate', AgreementOwnerPolicy: 'PerQueryPeriodObservedAgreementOwner',
    Columns: MANAGEMENT_RETURNS_COLUMNS.map(column => ({ ...column })), Filters: ['CurrentPeriod', 'PreviousPeriod'], RuntimeImplemented: true,
    RequiresCompleteNormalPublications: true, InputAvailability: 'CheckedByPreview', EffectiveSourcePeriodsVerified: false,
    SourceParityVerified: false, NativeCurrencyMappingVerified: false, AppliesFxConversion: false }
}
export function managementReturnsReport(): ManagementReturnsReport {
  const value = ['-5', '-10', '-50', '5']
  const cells: ManagementReturnsCell[] = MANAGEMENT_RETURNS_COLUMNS.map((column, index) => ({ Key: column.Key, Value: value[index], Available: true,
    ExactValue: { Numerator: value[index], Denominator: '1' }, FormattedValue: index === 2 ? '-50.00' : value[index] }))
  return { Version: 1, SourceIdentity: { ...MANAGEMENT_RETURNS_SOURCE }, ...initialManagementReturnsWindows('2026-09'),
    Grouping: 'Контрагент', ManagementCurrency: 'Управлінська валюта', InputBasis: 'NormalFenixSales22', PresentationBasis: 'CurrentGbaClrDecimal',
    RawVisibilityPolicy: 'DirectRegisterNoActivePredicate', AgreementOwnerPolicy: 'PerQueryPeriodObservedAgreementOwner',
    EffectiveSourcePeriodsVerified: false, SourceParityVerified: false, NativeCurrencyMappingVerified: false, AppliesFxConversion: false,
    Columns: MANAGEMENT_RETURNS_COLUMNS.map(column => ({ ...column })), Totals: cells,
    Rows: [{ Key: 'a'.repeat(64), Caption: 'Контрагент із OUR', NameAvailable: true, SourceNull: false, Cells: structuredClone(cells) }],
    Inputs: { Current: { Available: true, IncludedRows: 1, Code: 'available' }, Previous: { Available: true, IncludedRows: 1, Code: 'available' } },
    Complete: true, HasRows: true, CounterpartyNamesComplete: true, Code: 'available',
    ObservationStartedAtUtc: '2026-10-02T01:02:03.0000000Z', ObservationCompletedAtUtc: '2026-10-02T01:02:04.0000000Z',
    Proof: { SnapshotVerified: true, ObservationSha256: 'b'.repeat(64), CounterpartyNamesSha256: 'c'.repeat(64), Publications: [
      { BusinessMonth: '2026-08-01', RunId: '22222222-2222-2222-2222-222222222222', Available: true, PhysicalRows: 1, PagesPerPass: 1, CompletePassSha256: 'd'.repeat(64), Code: 'available' },
      { BusinessMonth: '2026-09-01', RunId: '33333333-3333-3333-3333-333333333333', Available: true, PhysicalRows: 1, PagesPerPass: 1, CompletePassSha256: 'e'.repeat(64), Code: 'available' },
    ] }, RequestSha256: 'f'.repeat(64), ResultSha256: '0'.repeat(64), DocumentURL: '/reports/returns.xlsx', PdfDocumentURL: '/reports/returns.pdf' }
}
export function managementReturnsEmptyReport(): ManagementReturnsReport {
  const report = managementReturnsReport()
  return { ...report, Rows: [], Complete: true, HasRows: false, Code: 'query_empty',
    Inputs: { Current: { Available: true, IncludedRows: 0, Code: 'query_empty' }, Previous: { Available: true, IncludedRows: 0, Code: 'query_empty' } },
    Totals: report.Totals.map((cell, index) => ({ ...cell, Available: index < 2, Value: null, ExactValue: null, FormattedValue: null })),
    Proof: { ...report.Proof, Publications: report.Proof.Publications.map(parent => ({ ...parent, PhysicalRows: 0 })) } }
}
export function managementReturnsMissingReport(): ManagementReturnsReport {
  const report = managementReturnsEmptyReport()
  return { ...report, Complete: false, Code: 'raw_sales_owner_query_input_unavailable',
    Inputs: { Current: { Available: false, IncludedRows: null, Code: 'period_publication_unavailable' },
      Previous: { Available: false, IncludedRows: null, Code: 'period_publication_unavailable' } },
    Totals: report.Totals.map(cell => ({ ...cell, Available: false })),
    Proof: { ...report.Proof, Publications: report.Proof.Publications.map(parent => ({ ...parent, Available: false, RunId: null,
      PhysicalRows: null, PagesPerPass: null, CompletePassSha256: null, Code: 'period_publication_unavailable' })) } }
}
export function managementReturnsUnknownCurrentReport(): ManagementReturnsReport {
  const report = managementReturnsReport()
  const cells = report.Totals.map((cell, index) => index === 1 ? cell : { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null })
  return { ...report, Complete: false, Code: 'raw_sales_owner_query_input_unavailable', Totals: cells, Rows: [{ ...report.Rows[0], Cells: structuredClone(cells) }],
    Inputs: { ...report.Inputs, Current: { Available: false, IncludedRows: null, Code: 'full_sales_owner_projection_unavailable' } },
    Proof: { ...report.Proof, Publications: [report.Proof.Publications[0], { ...report.Proof.Publications[1], Available: false,
      PhysicalRows: null, PagesPerPass: null, CompletePassSha256: null, Code: 'full_sales_owner_projection_unavailable' }] } }
}
export function managementReturnsCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${MANAGEMENT_RETURNS_SOURCE.SourceId}`, Name: MANAGEMENT_RETURNS_NAME, Title: MANAGEMENT_RETURNS_NAME, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: MANAGEMENT_RETURNS_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
