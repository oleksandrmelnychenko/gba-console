import type { ReportCatalogueEntry } from '../types'

export const EMPLOYEE_GROSS_PROFIT_SOURCE = { World: 'fenix', SourceId: '0xa27a000c29d0109a11de0f9c02197f18',
  DefinitionSha256: 'a67e95e9888417cc165cf7bccd2c9788de262ca485b79e5de47d2dda826c852e' } as const
export const EMPLOYEE_GROSS_PROFIT_NAME = 'Удельная валовая прибыль на сотрудника'
export const EMPLOYEE_GROSS_PROFIT_UNIT = 'FenixRawManagementСтоимость(Упр)'
export const EMPLOYEE_GROSS_PROFIT_INPUT_BASIS = 'DeclaredCompleteTurnoverResourcesAndResolvedEndpointEmployeeSets'
export const EMPLOYEE_GROSS_PROFIT_PRESENTATION_BASIS = 'CurrentGbaRawManagementResourcePerEmployee_TwoDecimalDisplay_NoFx'
export const EMPLOYEE_GROSS_PROFIT_EMPLOYEE_POLICY = 'NonDismissalBeforeLatestFourDimensionsPreserveAllPeriodTies'
export const EMPLOYEE_GROSS_PROFIT_MONETARY_POLICY = 'UnfilteredPhysicalMonthlyResources_ActiveRowsOnly_Signed_NoFX'
export const EMPLOYEE_GROSS_PROFIT_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: 2 },
  { Key: 'ПредыдущееЗначение', Caption: 'Предыдущее значение', DecimalPlaces: 2 },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: 2 },
] as const
type Policy = {
  DeclaredResourceUnit: typeof EMPLOYEE_GROSS_PROFIT_UNIT; PresentationBasis: typeof EMPLOYEE_GROSS_PROFIT_PRESENTATION_BASIS
  EmployeePolicy: typeof EMPLOYEE_GROSS_PROFIT_EMPLOYEE_POLICY; EmployeeActivePolicy: 'ActiveRecordsOnly'
  SourceParityVerified: false; SourceCurrencyIdentityVerified: false; NativeEmployeeSliceVerified: false
  NativeActiveVisibilityVerified: false; NativePrecisionVerified: false; EffectiveSourcePeriodsVerified: false
}
export type EmployeeGrossProfitCapabilities = Policy & {
  Version: 1; SourceIdentity: typeof EMPLOYEE_GROSS_PROFIT_SOURCE; ReportName: typeof EMPLOYEE_GROSS_PROFIT_NAME
  ScopeKind: 'TwoExplicitCurrentGbaCalendarMonths'; Columns: Array<typeof EMPLOYEE_GROSS_PROFIT_COLUMNS[number]>
  RuntimeImplemented: boolean; RequiresCompleteNormalPublications: true; InputAvailability: 'CheckedByPreview'
}
export type EmployeeGrossProfitRequest = { Version: 1; SourceIdentity: typeof EMPLOYEE_GROSS_PROFIT_SOURCE; Month: string }
type ExactNumber = { Numerator: string; Denominator: string }
type Money = { Available: boolean; Code: string; PhysicalRows: number | null; ActiveRows: number | null }
type Employees = { Available: boolean; Code: string; DistinctEmployees: number | null; PhysicalRows: number; ActiveRows: number
  EligibleRows: number; LatestRows: number; TiedGroups: number }
type Input = { Sales: Money; Cost: Money; Employees: Employees }
type MoneyParent = { RunId: string; Branch: number; Month: string; PassSha256: string; PhysicalRows: number; PagesPerPass: number }
type EmployeeParent = { RunId: string; Endpoint: string; PassSha256: string; SourceIdentitySha256: string; PhysicalRows: number; PagesPerPass: number }
type PeriodProof = { Sales: MoneyParent | null; Cost: MoneyParent | null; Employees: EmployeeParent | null }
export type EmployeeGrossProfitReport = Policy & {
  Version: 1; SourceIdentity: typeof EMPLOYEE_GROSS_PROFIT_SOURCE; Month: string
  CurrentPeriod: { From: string; ThroughExclusive: string }; PreviousPeriod: { From: string; ThroughExclusive: string }
  Columns: Array<typeof EMPLOYEE_GROSS_PROFIT_COLUMNS[number]>
  Cells: Array<{ Key: typeof EMPLOYEE_GROSS_PROFIT_COLUMNS[number]['Key']; Value: string | null; Available: boolean; ExactValue: ExactNumber | null; FormattedValue: string | null }>
  Inputs: { Current: Input; Previous: Input }; InputsComplete: boolean; Complete: boolean; HasRows: boolean
  Code: 'available' | 'confirmed_empty' | 'input_not_available' | 'arithmetic_not_representable'
  InputBasis: typeof EMPLOYEE_GROSS_PROFIT_INPUT_BASIS; MonetaryPolicy: typeof EMPLOYEE_GROSS_PROFIT_MONETARY_POLICY
  Proof: { Current: PeriodProof; Previous: PeriodProof; InputProofSha256: string; OurSnapshotVerified: true }
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const guid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
const code = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
function identity(value: unknown): boolean { return record(value) && Object.entries(EMPLOYEE_GROSS_PROFIT_SOURCE).every(([key, expected]) => value[key] === expected) }
function columns(value: unknown): boolean { return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(EMPLOYEE_GROSS_PROFIT_COLUMNS[index]).every(([key, expected]) => column[key] === expected)) }
function policy(value: Record<string, unknown>): boolean {
  return value.DeclaredResourceUnit === EMPLOYEE_GROSS_PROFIT_UNIT && value.PresentationBasis === EMPLOYEE_GROSS_PROFIT_PRESENTATION_BASIS
    && value.EmployeePolicy === EMPLOYEE_GROSS_PROFIT_EMPLOYEE_POLICY && value.EmployeeActivePolicy === 'ActiveRecordsOnly'
    && ['SourceParityVerified', 'SourceCurrencyIdentityVerified', 'NativeEmployeeSliceVerified', 'NativeActiveVisibilityVerified',
      'NativePrecisionVerified', 'EffectiveSourcePeriodsVerified'].every(key => value[key] === false)
}
export function isEmployeeGrossProfitCatalogueEntry(report: ReportCatalogueEntry): boolean {
  const matches = report.Sources.filter(source => source.World === EMPLOYEE_GROSS_PROFIT_SOURCE.World && source.SourceId === EMPLOYEE_GROSS_PROFIT_SOURCE.SourceId)
  return report.Id === `custom:fenix:${EMPLOYEE_GROSS_PROFIT_SOURCE.SourceId}` && matches.length === 1
    && (matches[0].DefinitionSha256 === null || matches[0].DefinitionSha256 === EMPLOYEE_GROSS_PROFIT_SOURCE.DefinitionSha256)
}
export function isEmployeeGrossProfitCapabilities(value: unknown): value is EmployeeGrossProfitCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && value.ReportName === EMPLOYEE_GROSS_PROFIT_NAME
    && value.ScopeKind === 'TwoExplicitCurrentGbaCalendarMonths' && columns(value.Columns) && policy(value)
    && typeof value.RuntimeImplemented === 'boolean' && value.RequiresCompleteNormalPublications === true && value.InputAvailability === 'CheckedByPreview'
}
export function employeeGrossProfitMonthError(month: string): string | null {
  return !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month <= '0001-01' || month >= '3998-12'
    ? 'Оберіть допустимий місяць із поточним і попереднім періодами.' : null
}
export function employeeGrossProfitPeriods(month: string): Pick<EmployeeGrossProfitReport, 'CurrentPeriod' | 'PreviousPeriod'> {
  if (employeeGrossProfitMonthError(month)) throw new Error('Некоректний місячний період прибутку на співробітника.')
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5))
  const shifted = (offset: number) => { const index = year * 12 + number - 1 + offset
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01` }
  return { CurrentPeriod: { From: shifted(0), ThroughExclusive: shifted(1) }, PreviousPeriod: { From: shifted(-1), ThroughExclusive: shifted(0) } }
}
export function createEmployeeGrossProfitRequest(capability: EmployeeGrossProfitCapabilities, month: string): EmployeeGrossProfitRequest {
  if (!isEmployeeGrossProfitCapabilities(capability) || !capability.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = employeeGrossProfitMonthError(month); if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...EMPLOYEE_GROSS_PROFIT_SOURCE }, Month: month }
}
function exact(value: unknown): value is ExactNumber {
  return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
    && value.Numerator.length <= 20000 && value.Denominator.length <= 20000
    && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator) && /^[1-9]\d*$/.test(value.Denominator)
    && (value.Numerator !== '0' || value.Denominator === '1')
}
function money(value: unknown): value is Money {
  if (!record(value) || typeof value.Available !== 'boolean' || !code(value.Code)) return false
  return value.Available ? count(value.PhysicalRows) && count(value.ActiveRows) && value.ActiveRows <= value.PhysicalRows
    : value.PhysicalRows === null && value.ActiveRows === null
}
function employees(value: unknown): value is Employees {
  if (!record(value) || typeof value.Available !== 'boolean' || !code(value.Code)
    || ![value.PhysicalRows, value.ActiveRows, value.EligibleRows, value.LatestRows, value.TiedGroups].every(count)) return false
  return (value.ActiveRows as number) <= (value.PhysicalRows as number) && (value.EligibleRows as number) <= (value.ActiveRows as number)
    && (value.LatestRows as number) <= (value.EligibleRows as number) && (value.TiedGroups as number) <= (value.LatestRows as number)
    && (value.Available ? count(value.DistinctEmployees) && value.DistinctEmployees <= (value.LatestRows as number) : value.DistinctEmployees === null)
}
function input(value: unknown): value is Input { return record(value) && money(value.Sales) && money(value.Cost) && employees(value.Employees) }
function cells(value: unknown): boolean {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== EMPLOYEE_GROSS_PROFIT_COLUMNS[index].Key || typeof cell.Available !== 'boolean'
      || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    return exact(cell.ExactValue) && decimal(cell.Value) && typeof cell.FormattedValue === 'string' && /^-?\d+\.\d{2}$/.test(cell.FormattedValue)
  })
}
function moneyParent(value: unknown, input: Money, month: string, branch: number): boolean {
  if (!input.Available) return value === null
  return record(value) && guid(value.RunId) && value.Branch === branch && value.Month === month && hash(value.PassSha256)
    && value.PhysicalRows === input.PhysicalRows && count(value.PagesPerPass) && value.PagesPerPass >= 1 && value.PagesPerPass <= 782
}
function employeeParent(value: unknown, input: Employees, endpoint: string): boolean {
  if (value === null) return !input.Available
  return record(value) && guid(value.RunId) && value.Endpoint === endpoint && hash(value.PassSha256) && hash(value.SourceIdentitySha256)
    && value.PhysicalRows === input.PhysicalRows && count(value.PagesPerPass) && value.PagesPerPass >= 1
}
function periodProof(value: unknown, input: Input, period: EmployeeGrossProfitReport['CurrentPeriod']): boolean {
  return record(value) && moneyParent(value.Sales, input.Sales, period.From, 1) && moneyParent(value.Cost, input.Cost, period.From, 3)
    && employeeParent(value.Employees, input.Employees, period.ThroughExclusive)
}
const complete = (input: Input) => input.Sales.Available && input.Cost.Available && input.Employees.Available
const hasRows = (input: Input) => (input.Sales.ActiveRows ?? 0) > 0 || (input.Cost.ActiveRows ?? 0) > 0 || (input.Employees.DistinctEmployees ?? 0) > 0
/** Checks request, shape and publication scope only; money and formatting are never calculated in the browser. */
export function normalizeEmployeeGrossProfitReport(value: unknown, request: EmployeeGrossProfitRequest): EmployeeGrossProfitReport {
  const periods = employeeGrossProfitPeriods(request.Month)
  if (!record(value) || value.Version !== 1 || !identity(value.SourceIdentity) || value.Month !== request.Month || !columns(value.Columns) || !policy(value)
    || value.InputBasis !== EMPLOYEE_GROSS_PROFIT_INPUT_BASIS || value.MonetaryPolicy !== EMPLOYEE_GROSS_PROFIT_MONETARY_POLICY
    || !record(value.CurrentPeriod) || !record(value.PreviousPeriod)
    || !Object.entries(periods.CurrentPeriod).every(([key, expected]) => (value.CurrentPeriod as Record<string, unknown>)[key] === expected)
    || !Object.entries(periods.PreviousPeriod).every(([key, expected]) => (value.PreviousPeriod as Record<string, unknown>)[key] === expected)
    || !record(value.Inputs) || !input(value.Inputs.Current) || !input(value.Inputs.Previous)
    || !cells(value.Cells) || typeof value.InputsComplete !== 'boolean' || typeof value.Complete !== 'boolean' || typeof value.HasRows !== 'boolean'
    || !hash(value.RequestSha256) || !hash(value.ResultSha256) || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string') throw invalid()
  const report = value as unknown as EmployeeGrossProfitReport, proof = value.Proof
  if (!record(proof) || proof.OurSnapshotVerified !== true || !hash(proof.InputProofSha256)
    || !periodProof(proof.Current, report.Inputs.Current, periods.CurrentPeriod) || !periodProof(proof.Previous, report.Inputs.Previous, periods.PreviousPeriod)
    || report.InputsComplete !== (complete(report.Inputs.Current) && complete(report.Inputs.Previous))
    || report.Complete !== (report.InputsComplete && report.Cells.every(cell => cell.Available))
    || report.HasRows !== (hasRows(report.Inputs.Current) || hasRows(report.Inputs.Previous))) throw invalid()
  const expected = !report.InputsComplete ? 'input_not_available' : !report.Complete ? 'arithmetic_not_representable' : report.HasRows ? 'available' : 'confirmed_empty'
  if (report.Code !== expected) throw invalid()
  return report
}
function invalid() { return new Error('Сервер повернув некоректний результат прибутку на співробітника або інший місячний період.') }
