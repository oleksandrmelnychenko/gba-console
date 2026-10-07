import type { ReportCatalogueEntry } from '../types'
import { MANAGEMENT_BALANCE_COLUMNS, MANAGEMENT_BALANCE_DEFINITIONS, managementBalanceEndpoints,
  type ManagementBalanceCapabilities, type ManagementBalanceKind, type ManagementBalanceReport } from './managementBalance'

export const MANAGEMENT_BALANCE_TEST_CALLER = '11111111-1111-1111-1111-111111111111'
export function managementBalanceCapability(kind: ManagementBalanceKind = 'monthlyReceivables'): ManagementBalanceCapabilities {
  const definition = MANAGEMENT_BALANCE_DEFINITIONS[kind]
  return { Version: 1, SourceIdentity: { ...definition.SourceIdentity }, ReportName: definition.ReportName, Periodicity: definition.Periodicity,
    ScopeKind: 'TwoCurrentGbaCalendarBalanceEndpoints', Filters: ['Period'], Columns: MANAGEMENT_BALANCE_COLUMNS.map(column => ({ ...column })),
    RuntimeImplemented: true, InputAvailability: 'CheckedByPreview', RequiresCompleteNormalPublications: true, Grouping: 'Контрагент',
    DeclaredResourceUnit: '(Упр)', InputBasis: 'NormalFenixManagementDatedOpeningAndContiguousMonths', PresentationBasis: 'CurrentGbaClrDecimal',
    SourceParityVerified: false, EffectiveSourcePeriodsVerified: false, AppliesFxConversion: false }
}
export function managementBalanceReport(kind: ManagementBalanceKind = 'monthlyReceivables'): ManagementBalanceReport {
  const capability = managementBalanceCapability(kind), period = kind === 'monthlyReceivables' ? '2026-09' : '2026-Q3'
  const endpoints = managementBalanceEndpoints(kind, period), values = ['5', '10', '-50', '-5']
  const cells = MANAGEMENT_BALANCE_COLUMNS.map((column, index) => ({ Key: column.Key, Available: true, Value: values[index],
    ExactValue: { Numerator: values[index], Denominator: '1' }, FormattedValue: index === 2 ? '-50.00' : values[index] }))
  const months = kind === 'monthlyReceivables' ? ['2026-09'] : ['2026-07', '2026-08', '2026-09']
  return { Version: 1, SourceIdentity: { ...capability.SourceIdentity }, Period: period, Periodicity: capability.Periodicity, ...endpoints,
    Columns: capability.Columns, Grouping: capability.Grouping, DeclaredResourceUnit: capability.DeclaredResourceUnit, InputBasis: capability.InputBasis,
    PresentationBasis: capability.PresentationBasis, SourceParityVerified: false, EffectiveSourcePeriodsVerified: false, AppliesFxConversion: false,
    Rows: [{ Key: 'a'.repeat(64), Caption: 'Контрагент із OUR', NameAvailable: true, Cells: structuredClone(cells) }], Totals: cells,
    Inputs: { Current: { ThroughExclusive: endpoints.CurrentThroughExclusive, Available: true, DatedOpeningComplete: true, MovementPrefixComplete: true, PhysicalRows: 2, Code: 'available' },
      Previous: { ThroughExclusive: endpoints.PreviousThroughExclusive, Available: true, DatedOpeningComplete: true, MovementPrefixComplete: true, PhysicalRows: 2, Code: 'available' } },
    Complete: true, HasRows: true, CounterpartyNamesComplete: true, Code: 'available',
    Proof: { OpeningRunId: '22222222-2222-2222-2222-222222222222', OpeningPassSha256: 'b'.repeat(64), BusinessBoundary: endpoints.PreviousThroughExclusive,
      SourceIdentitySha256: 'c'.repeat(64), MovementGenerations: months.map((month, index) => ({ Month: month,
        RunId: `${index + 3}3333333-3333-3333-3333-333333333333`, PassSha256: 'd'.repeat(64) })), InputProofSha256: 'e'.repeat(64),
      CounterpartyNamesSha256: 'f'.repeat(64), OurSnapshotVerified: true },
    RequestSha256: '0'.repeat(64), ResultSha256: '1'.repeat(64), DocumentURL: '/reports/balance.xlsx', PdfDocumentURL: '/reports/balance.pdf' }
}
export function managementBalanceEmptyReport(kind: ManagementBalanceKind = 'monthlyReceivables'): ManagementBalanceReport {
  const report = managementBalanceReport(kind)
  return { ...report, Rows: [], HasRows: false, Code: 'published_empty',
    Inputs: { Current: { ...report.Inputs.Current, PhysicalRows: 0 }, Previous: { ...report.Inputs.Previous, PhysicalRows: 0 } },
    Totals: report.Totals.map((cell, index) => ({ ...cell, Available: index < 2, Value: null, FormattedValue: null, ExactValue: null })) }
}
export function managementBalanceMissingReport(kind: ManagementBalanceKind = 'monthlyReceivables'): ManagementBalanceReport {
  const report = managementBalanceEmptyReport(kind)
  return { ...report, Complete: false, Code: 'balance_input_unavailable',
    Inputs: { Current: { ...report.Inputs.Current, Available: false, PhysicalRows: null, DatedOpeningComplete: false, MovementPrefixComplete: false, Code: 'dated_opening_publication_unavailable' },
      Previous: { ...report.Inputs.Previous, Available: false, PhysicalRows: null, DatedOpeningComplete: false, MovementPrefixComplete: false, Code: 'dated_opening_publication_unavailable' } },
    Totals: report.Totals.map(cell => ({ ...cell, Available: false })),
    Proof: { ...report.Proof, OpeningRunId: null, OpeningPassSha256: null, BusinessBoundary: null, SourceIdentitySha256: null, MovementGenerations: [] } }
}
export function managementBalanceCatalogueEntry(kind: ManagementBalanceKind = 'monthlyReceivables'): ReportCatalogueEntry {
  const definition = MANAGEMENT_BALANCE_DEFINITIONS[kind]
  return { Id: `custom:fenix:${definition.SourceIdentity.SourceId}`, Name: definition.ReportName, Title: definition.ReportName, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: definition.SourceIdentity.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
