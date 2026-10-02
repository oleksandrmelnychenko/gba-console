import { OVERDUE_RECEIVABLES_COLUMNS, OVERDUE_RECEIVABLES_FX_BASIS, OVERDUE_RECEIVABLES_INPUT_BASIS, OVERDUE_RECEIVABLES_NAME,
  OVERDUE_RECEIVABLES_PRESENTATION_BASIS, OVERDUE_RECEIVABLES_SOURCE, overdueReceivablesPeriods,
  type OverdueReceivablesCapabilities, type OverdueReceivablesInput, type OverdueReceivablesReport } from './overdueReceivables'
import type { ReportCatalogueEntry } from '../types'
const opening = '11111111-2222-3333-4444-555555555555'
export function overdueReceivablesCapability(): OverdueReceivablesCapabilities {
  return { Version: 1, SourceIdentity: { ...OVERDUE_RECEIVABLES_SOURCE }, ReportName: OVERDUE_RECEIVABLES_NAME,
    ScopeKind: 'TwoExplicitCurrentGbaCalendarMonths', Periodicity: 'Month', ManagementCurrency: 'EUR', FxBasis: OVERDUE_RECEIVABLES_FX_BASIS,
    InputBasis: OVERDUE_RECEIVABLES_INPUT_BASIS, PresentationBasis: OVERDUE_RECEIVABLES_PRESENTATION_BASIS,
    Columns: OVERDUE_RECEIVABLES_COLUMNS.map(column => ({ ...column })), RuntimeImplemented: true,
    RequiresCompleteNormalPublications: true, InputAvailability: 'CheckedByPreview', SourceParityVerified: false, EffectiveSourcePeriodsVerified: false }
}
export function overdueReceivablesInput(empty = false): OverdueReceivablesInput {
  return { CompleteBalanceCoverage: true, OpeningPhysicalRows: 1, MovementPhysicalRows: 0,
    BalanceGrains: empty ? 0 : 1, PositiveGrains: empty ? 0 : 1, UnknownTermsGrains: 0, Code: 'available' }
}
export function overdueReceivablesReport(month = '2026-09'): OverdueReceivablesReport {
  const periods = overdueReceivablesPeriods(month), before = periods.PreviousPeriod.From
  const values = ['1', '3', '-66.666666666666666666666666667', '-2'], formatted = ['1', '3', '-66.67', '-2']
  const exact = [{ Numerator: '1', Denominator: '1' }, { Numerator: '3', Denominator: '1' },
    { Numerator: '-200', Denominator: '3' }, { Numerator: '-2', Denominator: '1' }]
  const cells = OVERDUE_RECEIVABLES_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], Available: true,
    ExactValue: exact[index], FormattedValue: formatted[index] }))
  return { Version: 1, SourceIdentity: { ...OVERDUE_RECEIVABLES_SOURCE }, Month: month, ...periods,
    Columns: OVERDUE_RECEIVABLES_COLUMNS.map(column => ({ ...column })), Cells: cells,
    Rows: [{ CounterpartyReference: '00000000000000000000000000000004', NameAvailable: true, CounterpartyName: 'Контрагент із OUR', Cells: cells.map(cell => ({ ...cell })) }],
    Inputs: { Current: overdueReceivablesInput(), Previous: overdueReceivablesInput() }, Complete: true, HasRows: true, Code: 'available',
    InputBasis: OVERDUE_RECEIVABLES_INPUT_BASIS, PresentationBasis: OVERDUE_RECEIVABLES_PRESENTATION_BASIS,
    ManagementCurrency: 'EUR', FxBasis: OVERDUE_RECEIVABLES_FX_BASIS,
    Proof: { OpeningRunId: opening, OpeningPassSha256: 'a'.repeat(64), BusinessBoundary: before,
      MovementGenerations: [{ ThroughExclusive: periods.PreviousPeriod.ThroughExclusive, RunId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', PassSha256: 'c'.repeat(64) },
        { ThroughExclusive: periods.CurrentPeriod.ThroughExclusive, RunId: 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff', PassSha256: 'd'.repeat(64) }], InputProofSha256: 'e'.repeat(64), OurSnapshotVerified: true },
    SourceParityVerified: false, EffectiveSourcePeriodsVerified: false, RequestSha256: 'f'.repeat(64), ResultSha256: '1'.repeat(64),
    DocumentURL: '/files/overdue-receivables.xlsx', PdfDocumentURL: '/files/overdue-receivables.pdf' }
}
export function overdueReceivablesEmptyReport(): OverdueReceivablesReport {
  const report = overdueReceivablesReport()
  return { ...report, Complete: true, HasRows: false, Code: 'published_empty', Rows: [],
    Inputs: { Current: overdueReceivablesInput(true), Previous: overdueReceivablesInput(true) },
    Cells: report.Cells.map((cell, index) => ({ ...cell, Available: true, Value: index < 2 ? null : index === 2 ? '100' : '0',
      ExactValue: index < 2 ? null : { Numerator: index === 2 ? '100' : '0', Denominator: '1' }, FormattedValue: index < 2 ? null : index === 2 ? '100.00' : '0' })) }
}
export function overdueReceivablesUnknownCurrentReport(): OverdueReceivablesReport {
  const report = overdueReceivablesEmptyReport()
  report.Complete = false; report.Code = 'input_not_available'
  report.Inputs.Current = { ...report.Inputs.Current, CompleteBalanceCoverage: false, Code: 'document_monthly_prefix_publication_unavailable' }
  report.Cells[0] = { ...report.Cells[0], Available: false }
  report.Cells[3] = { ...report.Cells[3], Available: false, Value: null, ExactValue: null, FormattedValue: null }
  return report
}
export function overdueReceivablesMissingReport(): OverdueReceivablesReport {
  const report = overdueReceivablesEmptyReport()
  report.Complete = false; report.Code = 'input_not_available'
  for (const name of ['Current', 'Previous'] as const) report.Inputs[name] = { ...report.Inputs[name], CompleteBalanceCoverage: false, Code: 'document_dated_opening_publication_unavailable' }
  report.Cells = report.Cells.map(cell => ({ ...cell, Available: false, Value: null, ExactValue: null, FormattedValue: null }))
  report.Proof = { ...report.Proof, OpeningRunId: null, OpeningPassSha256: null, BusinessBoundary: null, MovementGenerations: [] }
  return report
}
export function overdueReceivablesCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${OVERDUE_RECEIVABLES_SOURCE.SourceId}`, Name: OVERDUE_RECEIVABLES_NAME, Title: OVERDUE_RECEIVABLES_NAME, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: OVERDUE_RECEIVABLES_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
