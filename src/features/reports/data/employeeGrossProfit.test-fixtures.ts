import { EMPLOYEE_GROSS_PROFIT_COLUMNS, EMPLOYEE_GROSS_PROFIT_EMPLOYEE_POLICY, EMPLOYEE_GROSS_PROFIT_INPUT_BASIS,
  EMPLOYEE_GROSS_PROFIT_MONETARY_POLICY, EMPLOYEE_GROSS_PROFIT_NAME, EMPLOYEE_GROSS_PROFIT_PRESENTATION_BASIS,
  EMPLOYEE_GROSS_PROFIT_SOURCE, EMPLOYEE_GROSS_PROFIT_UNIT, employeeGrossProfitPeriods,
  type EmployeeGrossProfitCapabilities, type EmployeeGrossProfitReport } from './employeeGrossProfit'
import type { ReportCatalogueEntry } from '../types'
const policy = { DeclaredResourceUnit: EMPLOYEE_GROSS_PROFIT_UNIT, PresentationBasis: EMPLOYEE_GROSS_PROFIT_PRESENTATION_BASIS,
  EmployeePolicy: EMPLOYEE_GROSS_PROFIT_EMPLOYEE_POLICY, EmployeeActivePolicy: 'ActiveRecordsOnly',
  SourceParityVerified: false, SourceCurrencyIdentityVerified: false, NativeEmployeeSliceVerified: false,
  NativeActiveVisibilityVerified: false, NativePrecisionVerified: false, EffectiveSourcePeriodsVerified: false } as const
export function employeeGrossProfitCapability(): EmployeeGrossProfitCapabilities {
  return { Version: 1, SourceIdentity: { ...EMPLOYEE_GROSS_PROFIT_SOURCE }, ReportName: EMPLOYEE_GROSS_PROFIT_NAME,
    ScopeKind: 'TwoExplicitCurrentGbaCalendarMonths', Columns: EMPLOYEE_GROSS_PROFIT_COLUMNS.map(column => ({ ...column })),
    RuntimeImplemented: true, RequiresCompleteNormalPublications: true, InputAvailability: 'CheckedByPreview', ...policy }
}
function input(empty: boolean): EmployeeGrossProfitReport['Inputs']['Current'] {
  const rows = empty ? 0 : 1
  return { Sales: { Available: true, Code: 'available', PhysicalRows: rows, ActiveRows: rows },
    Cost: { Available: true, Code: 'available', PhysicalRows: rows, ActiveRows: rows },
    Employees: { Available: true, Code: 'available', DistinctEmployees: rows, PhysicalRows: rows, ActiveRows: rows,
      EligibleRows: rows, LatestRows: rows, TiedGroups: 0 } }
}
function parent(period: EmployeeGrossProfitReport['CurrentPeriod'], empty: boolean, suffix: string): EmployeeGrossProfitReport['Proof']['Current'] {
  const rows = empty ? 0 : 1, run = `11111111-2222-3333-4444-${suffix.repeat(12)}`
  return { Sales: { RunId: run, Branch: 1, Month: period.From, PassSha256: 'a'.repeat(64), PhysicalRows: rows, PagesPerPass: 1 },
    Cost: { RunId: '22222222-2222-3333-4444-'+suffix.repeat(12), Branch: 3, Month: period.From, PassSha256: 'b'.repeat(64), PhysicalRows: rows, PagesPerPass: 1 },
    Employees: { RunId: '33333333-2222-3333-4444-'+suffix.repeat(12), Endpoint: period.ThroughExclusive,
      PassSha256: 'c'.repeat(64), SourceIdentitySha256: 'd'.repeat(64), PhysicalRows: rows, PagesPerPass: 1 } }
}
/** Synthetic wire fixture matching the actual 8390 DTO; it is not a runtime publication receipt. */
export function employeeGrossProfitReport(month = '2026-09', empty = false): EmployeeGrossProfitReport {
  const periods = employeeGrossProfitPeriods(month), values = empty ? ['0', '0', '100', '0'] : ['9', '9', '0', '0']
  return { Version: 1, SourceIdentity: { ...EMPLOYEE_GROSS_PROFIT_SOURCE }, Month: month, ...periods, ...policy,
    Columns: EMPLOYEE_GROSS_PROFIT_COLUMNS.map(column => ({ ...column })),
    Cells: EMPLOYEE_GROSS_PROFIT_COLUMNS.map((column, index) => ({ Key: column.Key, Available: true, Value: values[index],
      ExactValue: { Numerator: values[index], Denominator: '1' }, FormattedValue: values[index]+'.00' })),
    Inputs: { Current: input(empty), Previous: input(empty) }, InputsComplete: true, Complete: true, HasRows: !empty,
    Code: empty ? 'confirmed_empty' : 'available', InputBasis: EMPLOYEE_GROSS_PROFIT_INPUT_BASIS, MonetaryPolicy: EMPLOYEE_GROSS_PROFIT_MONETARY_POLICY,
    Proof: { Current: parent(periods.CurrentPeriod, empty, '5'), Previous: parent(periods.PreviousPeriod, empty, '6'),
      InputProofSha256: 'e'.repeat(64), OurSnapshotVerified: true }, RequestSha256: 'f'.repeat(64), ResultSha256: '1'.repeat(64),
    DocumentURL: '/files/employee-gross-profit.xlsx', PdfDocumentURL: '/files/employee-gross-profit.pdf' }
}
export function employeeGrossProfitEmptyReport(): EmployeeGrossProfitReport { return employeeGrossProfitReport('2026-09', true) }
export function employeeGrossProfitUnknownCurrentReport(): EmployeeGrossProfitReport {
  const report = employeeGrossProfitEmptyReport()
  report.InputsComplete = false; report.Complete = false; report.Code = 'input_not_available'
  report.Inputs.Current = { Sales: { Available: false, Code: 'not_published', PhysicalRows: null, ActiveRows: null },
    Cost: { Available: false, Code: 'not_published', PhysicalRows: null, ActiveRows: null },
    Employees: { ...report.Inputs.Current.Employees, Available: false, Code: 'not_published', DistinctEmployees: null } }
  report.Proof.Current = { Sales: null, Cost: null, Employees: null }
  for (const index of [0, 3]) report.Cells[index] = { ...report.Cells[index], Available: false, Value: null, FormattedValue: null, ExactValue: null }
  return report
}
export function employeeGrossProfitMissingReport(): EmployeeGrossProfitReport {
  const report = employeeGrossProfitUnknownCurrentReport()
  report.Inputs.Previous = structuredClone(report.Inputs.Current); report.Proof.Previous = { Sales: null, Cost: null, Employees: null }
  report.Cells = report.Cells.map(cell => ({ ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null }))
  return report
}
export function employeeGrossProfitCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${EMPLOYEE_GROSS_PROFIT_SOURCE.SourceId}`, Name: EMPLOYEE_GROSS_PROFIT_NAME, Title: EMPLOYEE_GROSS_PROFIT_NAME, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: EMPLOYEE_GROSS_PROFIT_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
