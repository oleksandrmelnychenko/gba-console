import { DEFECT_PRODUCTION_BASIS, DEFECT_PRODUCTION_COLUMNS, DEFECT_PRODUCTION_NAME, DEFECT_PRODUCTION_SOURCE, defectProductionWindows,
  type DefectProductionCapabilities, type DefectProductionCell, type DefectProductionReport } from './defectProduction'
import type { ReportCatalogueEntry } from '../types'

export const DEFECT_PRODUCTION_TEST_CALLER = '11111111-1111-1111-1111-111111111111'
export function defectProductionCapability(): DefectProductionCapabilities {
  return { ...DEFECT_PRODUCTION_BASIS, Version: 1, SourceIdentity: { ...DEFECT_PRODUCTION_SOURCE }, ReportName: DEFECT_PRODUCTION_NAME,
    Periodicity: 'Month', ScopeKind: 'CurrentGbaMonthAndPreviousMonth', Grouping: 'Scalar',
    Columns: DEFECT_PRODUCTION_COLUMNS.map(column => ({ ...column })), Filters: ['Month'], RuntimeImplemented: true,
    RequiresCompleteNormalPublications: true, InputAvailability: 'CheckedByPreview' }
}
export function defectProductionReport(): DefectProductionReport {
  const values = ['0.2', '0.4', '-50', '-0.2'], numerators = ['1', '2', '-50', '-1'], denominators = ['5', '5', '1', '5']
  const cells: DefectProductionCell[] = DEFECT_PRODUCTION_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], Available: true,
    ExactValue: { Numerator: numerators[index], Denominator: denominators[index] }, FormattedValue: index === 2 ? '-50.00' : values[index] }))
  return { ...DEFECT_PRODUCTION_BASIS, Version: 1, SourceIdentity: { ...DEFECT_PRODUCTION_SOURCE }, Month: '2026-09', ...defectProductionWindows('2026-09'),
    PresentationBasis: 'CurrentGbaClrDecimal', Columns: DEFECT_PRODUCTION_COLUMNS.map(column => ({ ...column })), Cells: cells,
    Inputs: { Current: { Available: true, IncludedRows: 1, Code: 'available' }, Previous: { Available: true, IncludedRows: 1, Code: 'available' } },
    Complete: true, HasRows: true, Code: 'available',
    ObservationStartedAtUtc: '2026-10-02T01:02:03.0000000Z', ObservationCompletedAtUtc: '2026-10-02T01:02:04.0000000Z',
    Proof: { SnapshotVerified: true, ObservationSha256: 'b'.repeat(64), Publications: [
      { BusinessMonth: '2026-08-01', RunId: '22222222-2222-2222-2222-222222222222', Available: true, PhysicalRows: 1, PagesPerPass: 1, CompletePassSha256: 'd'.repeat(64), Code: 'available' },
      { BusinessMonth: '2026-09-01', RunId: '33333333-3333-3333-3333-333333333333', Available: true, PhysicalRows: 1, PagesPerPass: 1, CompletePassSha256: 'e'.repeat(64), Code: 'available' },
    ] }, RequestSha256: 'f'.repeat(64), ResultSha256: '0'.repeat(64), DocumentURL: '/reports/defect.xlsx', PdfDocumentURL: '/reports/defect.pdf' }
}
export function defectProductionZeroReport(): DefectProductionReport {
  const report = defectProductionReport(), values = ['0', '0', '100', '0']
  return { ...report, Cells: report.Cells.map((cell, index) => ({ ...cell, Value: values[index], FormattedValue: index === 2 ? '100.00' : values[index],
    ExactValue: { Numerator: values[index], Denominator: '1' } })) }
}
export function defectProductionEmptyReport(): DefectProductionReport {
  const report = defectProductionZeroReport()
  return { ...report, HasRows: false, Code: 'published_empty',
    Inputs: { Current: { Available: true, IncludedRows: 0, Code: 'query_empty' }, Previous: { Available: true, IncludedRows: 0, Code: 'query_empty' } },
    Cells: report.Cells.map((cell, index) => index < 2 ? { ...cell, Value: null, ExactValue: null, FormattedValue: null } : cell),
    Proof: { ...report.Proof, Publications: report.Proof.Publications.map(parent => ({ ...parent, PhysicalRows: 0 })) } }
}
export function defectProductionMissingReport(): DefectProductionReport {
  const report = defectProductionEmptyReport()
  return { ...report, Complete: false, Code: 'production_input_unavailable',
    Inputs: { Current: { Available: false, IncludedRows: null, Code: 'period_publication_unavailable' },
      Previous: { Available: false, IncludedRows: null, Code: 'period_publication_unavailable' } },
    Cells: report.Cells.map(cell => ({ ...cell, Available: false, Value: null, ExactValue: null, FormattedValue: null })),
    Proof: { ...report.Proof, Publications: report.Proof.Publications.map(parent => ({ ...parent, Available: false, RunId: null,
      PhysicalRows: null, PagesPerPass: null, CompletePassSha256: null, Code: 'period_publication_unavailable' })) } }
}
export function defectProductionUnknownCurrentReport(): DefectProductionReport {
  const report = defectProductionReport()
  return { ...report, Complete: false, Code: 'production_input_unavailable',
    Cells: report.Cells.map((cell, index) => index === 1 ? cell : { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null }),
    Inputs: { ...report.Inputs, Current: { Available: false, IncludedRows: null, Code: 'production_quality_unavailable' } } }
}
export function defectProductionNullPreviousReport(): DefectProductionReport {
  const report = defectProductionReport()
  return { ...report, Cells: report.Cells.map((cell, index) => index === 1 ? { ...cell, Value: null, FormattedValue: null, ExactValue: null }
    : index === 2 ? { ...cell, Value: '100', FormattedValue: '100.00', ExactValue: { Numerator: '100', Denominator: '1' } }
    : index === 3 ? { ...cell, Value: '0.2', FormattedValue: '0.2', ExactValue: { Numerator: '1', Denominator: '5' } } : cell),
    Inputs: { ...report.Inputs, Previous: { Available: true, IncludedRows: 0, Code: 'query_empty' } },
    Proof: { ...report.Proof, Publications: [{ ...report.Proof.Publications[0], PhysicalRows: 0 }, report.Proof.Publications[1]] } }
}
export function defectProductionUnknownCurrentZeroPreviousReport(): DefectProductionReport {
  const report = defectProductionUnknownCurrentReport()
  return { ...report, Cells: report.Cells.map((cell, index) => index === 1 ? { ...cell, Value: '0', FormattedValue: '0', ExactValue: { Numerator: '0', Denominator: '1' } }
    : index === 2 ? { ...cell, Available: true, Value: '100', FormattedValue: '100.00', ExactValue: { Numerator: '100', Denominator: '1' } } : cell) }
}
export function defectProductionCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${DEFECT_PRODUCTION_SOURCE.SourceId}`, Name: DEFECT_PRODUCTION_NAME, Title: DEFECT_PRODUCTION_NAME, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: DEFECT_PRODUCTION_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}

export function defectProductionUnknownCurrentNullPreviousReport(): DefectProductionReport {
  const report = defectProductionUnknownCurrentZeroPreviousReport()
  return { ...report, HasRows: false,
    Cells: report.Cells.map((cell, index) => index === 1 ? { ...cell, Value: null, ExactValue: null, FormattedValue: null } : cell),
    Inputs: { ...report.Inputs, Previous: { Available: true, IncludedRows: 0, Code: 'query_empty' } },
    Proof: { ...report.Proof, Publications: [{ ...report.Proof.Publications[0], PhysicalRows: 0 }, report.Proof.Publications[1]] } }
}
