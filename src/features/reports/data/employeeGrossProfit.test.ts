import { expect, it } from 'vitest'
import { createEmployeeGrossProfitRequest, employeeGrossProfitMonthError, employeeGrossProfitPeriods,
  isEmployeeGrossProfitCapabilities, isEmployeeGrossProfitCatalogueEntry, normalizeEmployeeGrossProfitReport } from './employeeGrossProfit'
import { employeeGrossProfitCapability, employeeGrossProfitCatalogueEntry, employeeGrossProfitEmptyReport,
  employeeGrossProfitMissingReport, employeeGrossProfitReport, employeeGrossProfitUnknownCurrentReport } from './employeeGrossProfit.test-fixtures'
const request = () => createEmployeeGrossProfitRequest(employeeGrossProfitCapability(), '2026-09')
it('pins exact source, declared management unit and OUR employee policy without claiming native precision, FX or parity', () => {
  const caps = employeeGrossProfitCapability()
  expect(isEmployeeGrossProfitCapabilities(caps)).toBe(true)
  for (const update of [{ SourceParityVerified: true }, { DeclaredResourceUnit: 'EUR' }, { NativeEmployeeSliceVerified: true },
    { EmployeeActivePolicy: 'AllRecords' }, { NativePrecisionVerified: true }, { InputAvailability: 'Ready' }])
    expect(isEmployeeGrossProfitCapabilities({ ...caps, ...update })).toBe(false)
  expect(isEmployeeGrossProfitCatalogueEntry(employeeGrossProfitCatalogueEntry())).toBe(true)
  const duplicate = employeeGrossProfitCatalogueEntry(); duplicate.Sources.push(duplicate.Sources[0]); expect(isEmployeeGrossProfitCatalogueEntry(duplicate)).toBe(false)
})
it('matches the strict employee endpoint month domain and does only calendar shifting in the browser', () => {
  expect(employeeGrossProfitPeriods('2027-01')).toEqual({ CurrentPeriod: { From: '2027-01-01', ThroughExclusive: '2027-02-01' }, PreviousPeriod: { From: '2026-12-01', ThroughExclusive: '2027-01-01' } })
  expect(employeeGrossProfitMonthError('0001-02')).toBeNull(); expect(employeeGrossProfitMonthError('3998-11')).toBeNull()
  for (const month of ['0001-01', '3998-12', '4000-01', '2026-9', '2026-Q3']) expect(employeeGrossProfitMonthError(month)).not.toBeNull()
})
it('retains server raw, exact and formatted cells verbatim without dividing or rounding money', () => {
  const report = employeeGrossProfitReport()
  report.Cells[0] = { ...report.Cells[0], Value: '0.3333333333333333333333333333', ExactValue: { Numerator: '1', Denominator: '3' }, FormattedValue: '0.33' }
  expect(Object.keys(request())).toEqual(['Version', 'SourceIdentity', 'Month'])
  expect(normalizeEmployeeGrossProfitReport(report, request())).toBe(report)
  expect(report.Cells[0].FormattedValue).toBe('0.33')
})
it('separates confirmed empty real parents with zero and100 from missing publications', () => {
  const empty = employeeGrossProfitEmptyReport(), missing = employeeGrossProfitMissingReport()
  expect(normalizeEmployeeGrossProfitReport(empty, request())).toBe(empty)
  expect(empty.Cells.map(cell => cell.FormattedValue)).toEqual(['0.00', '0.00', '100.00', '0.00'])
  expect(normalizeEmployeeGrossProfitReport(missing, request())).toBe(missing)
  expect(missing.Cells.every(cell => !cell.Available && cell.Value === null)).toBe(true)
})
it('retains known previous zero and independent100 when current is unavailable', () => {
  const report = employeeGrossProfitUnknownCurrentReport()
  expect(normalizeEmployeeGrossProfitReport(report, request())).toBe(report)
  expect(report.Cells.map(cell => cell.FormattedValue)).toEqual([null, '0.00', '100.00', null])
  expect(() => normalizeEmployeeGrossProfitReport({ ...report, InputsComplete: true }, request())).toThrow('некоректний результат')
})
it('distinguishes complete inputs from a representability refusal while retaining exact evidence', () => {
  const report = employeeGrossProfitReport(); report.Complete = false; report.Code = 'arithmetic_not_representable'
  report.Cells[2] = { ...report.Cells[2], Available: false, Value: null, FormattedValue: null, ExactValue: { Numerator: '1'+'0'.repeat(30), Denominator: '1' } }
  expect(normalizeEmployeeGrossProfitReport(report, request())).toBe(report)
})
it('requires exact current and previous monthly generations, branch3 cost and endpoint history parents', () => {
  const scope = employeeGrossProfitReport(); scope.Proof.Current.Sales!.Month = '2026-08-01'
  const branch = employeeGrossProfitReport(); branch.Proof.Current.Cost!.Branch = 1
  const endpoint = employeeGrossProfitReport(); endpoint.Proof.Previous.Employees!.Endpoint = '2026-10-01'
  const missing = employeeGrossProfitReport(); missing.Proof.Current.Cost = null
  const count = employeeGrossProfitReport(); count.Proof.Current.Sales!.PhysicalRows = 2
  for (const report of [scope, branch, endpoint, missing, count, { ...employeeGrossProfitReport(), Proof: { ...employeeGrossProfitReport().Proof, OurSnapshotVerified: false } }])
    expect(() => normalizeEmployeeGrossProfitReport(report, request())).toThrow('некоректний результат')
})
it('refuses another period, malformed cells/counts, mismatched unit/policy and falsely empty reports before file use', () => {
  const counts = employeeGrossProfitReport(); counts.Inputs.Current.Employees.DistinctEmployees = 2
  const format = employeeGrossProfitReport(); format.Cells[0].FormattedValue = null
  for (const report of [employeeGrossProfitReport('2026-08'), counts, format, { ...employeeGrossProfitReport(), HasRows: false },
    { ...employeeGrossProfitReport(), DeclaredResourceUnit: 'EUR' }, { ...employeeGrossProfitReport(), NativeActiveVisibilityVerified: true }])
    expect(() => normalizeEmployeeGrossProfitReport(report, request())).toThrow('некоректний результат')
})
