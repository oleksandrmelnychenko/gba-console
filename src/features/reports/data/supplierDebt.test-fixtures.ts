import { SUPPLIER_DEBT_COLUMNS, SUPPLIER_DEBT_INPUT_BASIS, SUPPLIER_DEBT_NAME, SUPPLIER_DEBT_PRESENTATION_BASIS, SUPPLIER_DEBT_SOURCE,
  supplierDebtPeriods, type SupplierDebtCapabilities, type SupplierDebtInput, type SupplierDebtReport } from './supplierDebt'
import type { ReportCatalogueEntry } from '../types'
const opening = '11111111-2222-3333-4444-555555555555'
export function supplierDebtCapability(): SupplierDebtCapabilities {
  return { Version: 1, SourceIdentity: { ...SUPPLIER_DEBT_SOURCE }, ReportName: SUPPLIER_DEBT_NAME,
    ScopeKind: 'TwoExplicitCurrentGbaCalendarMonths', InputBasis: SUPPLIER_DEBT_INPUT_BASIS, PresentationBasis: SUPPLIER_DEBT_PRESENTATION_BASIS,
    Columns: SUPPLIER_DEBT_COLUMNS.map(column => ({ ...column })), RuntimeImplemented: true,
    RequiresCompleteNormalPublications: true, InputAvailability: 'CheckedByPreview', SourceParityVerified: false, EffectiveSourcePeriodsVerified: false }
}
export function supplierDebtInput(endpoint: string, value: string | null): SupplierDebtInput {
  return { Available: true, PublicationId: opening, ThroughExclusive: endpoint, DatedOpeningComplete: true, MovementPrefixComplete: true,
    BalanceGrainRows: value === null ? 0 : 1, IncludedGrainRows: value === null ? 0 : 1, UnknownKindGrains: 0, InvalidGrains: 0, Code: 'available',
    ManagementBalanceSum: value === null ? null : { Numerator: value, Denominator: '1' } }
}
export function supplierDebtReport(month = '2026-09'): SupplierDebtReport {
  const periods = supplierDebtPeriods(month), before = periods.PreviousPeriod.From
  const values = ['-1', '-3', '-66.666666666666666666666666667', '2'], formatted = ['-1', '-3', '-66.67', '2.00']
  const exact = [{ Numerator: '-1', Denominator: '1' }, { Numerator: '-3', Denominator: '1' },
    { Numerator: '-200', Denominator: '3' }, { Numerator: '2', Denominator: '1' }]
  return { Version: 1, SourceIdentity: { ...SUPPLIER_DEBT_SOURCE }, Month: month, ...periods,
    Columns: SUPPLIER_DEBT_COLUMNS.map(column => ({ ...column })), Cells: SUPPLIER_DEBT_COLUMNS.map((column, index) => ({
      Key: column.Key, Value: values[index], Available: true, ExactValue: exact[index], FormattedValue: formatted[index] })),
    Inputs: { Current: supplierDebtInput(periods.CurrentPeriod.ThroughExclusive, '-1'), Previous: supplierDebtInput(periods.PreviousPeriod.ThroughExclusive, '-3') },
    Complete: true, HasRows: true, Code: 'available', InputBasis: SUPPLIER_DEBT_INPUT_BASIS, PresentationBasis: SUPPLIER_DEBT_PRESENTATION_BASIS,
    Proof: { OpeningRunId: opening, OpeningPassSha256: 'a'.repeat(64), BusinessBoundary: before, SourceIdentitySha256: 'b'.repeat(64),
      MovementGenerations: [{ BusinessMonth: before, RunId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', PassSha256: 'c'.repeat(64) },
        { BusinessMonth: periods.CurrentPeriod.From, RunId: 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff', PassSha256: 'd'.repeat(64) }], InputProofSha256: 'e'.repeat(64), OurSnapshotVerified: true },
    SourceParityVerified: false, EffectiveSourcePeriodsVerified: false, RequestSha256: 'f'.repeat(64), ResultSha256: '1'.repeat(64),
    DocumentURL: '/files/supplier-debt.xlsx', PdfDocumentURL: '/files/supplier-debt.pdf' }
}
export function supplierDebtEmptyReport(): SupplierDebtReport {
  const report = supplierDebtReport()
  return { ...report, Complete: true, HasRows: false, Code: 'published_empty',
    Inputs: { Current: supplierDebtInput(report.CurrentPeriod.ThroughExclusive, null), Previous: supplierDebtInput(report.PreviousPeriod.ThroughExclusive, null) },
    Cells: report.Cells.map((cell, index) => ({ ...cell, Available: index < 2, Value: null, ExactValue: null, FormattedValue: null })) }
}
export function supplierDebtUnknownCurrentReport(): SupplierDebtReport {
  const report = supplierDebtEmptyReport()
  report.Complete = false; report.Code = 'input_not_available'
  report.Inputs.Current = { ...report.Inputs.Current, Available: false, BalanceGrainRows: 1, UnknownKindGrains: 1, Code: 'agreement_kind_unavailable_or_changed' }
  report.Cells[0] = { ...report.Cells[0], Available: false }
  report.Cells[2] = { ...report.Cells[2], Available: true, Value: '100', ExactValue: { Numerator: '100', Denominator: '1' }, FormattedValue: '100.00' }
  return report
}
export function supplierDebtMissingReport(): SupplierDebtReport {
  const report = supplierDebtEmptyReport()
  report.Complete = false; report.Code = 'input_not_available'
  for (const name of ['Current', 'Previous'] as const) report.Inputs[name] = { ...report.Inputs[name], Available: false, PublicationId: null,
    DatedOpeningComplete: false, MovementPrefixComplete: false, Code: 'opening_publication_unavailable' }
  report.Cells = report.Cells.map(cell => ({ ...cell, Available: false }))
  report.Proof = { ...report.Proof, OpeningRunId: null, OpeningPassSha256: null, BusinessBoundary: null, SourceIdentitySha256: null, MovementGenerations: [] }
  return report
}
export function supplierDebtCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${SUPPLIER_DEBT_SOURCE.SourceId}`, Name: SUPPLIER_DEBT_NAME, Title: SUPPLIER_DEBT_NAME, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: SUPPLIER_DEBT_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
