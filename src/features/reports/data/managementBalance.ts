import type { ReportCatalogueEntry } from '../types'
import { isManagementReturnsDocumentUrl } from './managementReturns'

export type ManagementBalanceKind = 'monthlyReceivables' | 'quarterlyManagementPayables'
export const MANAGEMENT_BALANCE_DEFINITIONS = {
  monthlyReceivables: { SourceIdentity: { World: 'fenix', SourceId: '0xb4b500055d78a52511ddfc119072d00a',
    DefinitionSha256: 'a33e4ebaffc87b7bc8876be450a56196abdff8f372097f2bc3ac91ecc77b90ee' },
    ReportName: 'Дебиторская задолженность', Periodicity: 'Month', Route: '/report/constructors/management-receivables' },
  quarterlyManagementPayables: { SourceIdentity: { World: 'fenix', SourceId: '0xb4b500055d78a52511ddfc172c5097fb',
    DefinitionSha256: '8c78573d64822a19e865cfdfe44ab4dfe0960be417b818916d5aebab789df352' },
    ReportName: 'Кредиторская задолженность (упр)', Periodicity: 'Quarter', Route: '/report/constructors/management-payables' },
} as const
export const MANAGEMENT_BALANCE_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
type Identity = typeof MANAGEMENT_BALANCE_DEFINITIONS[ManagementBalanceKind]['SourceIdentity']
type Basis = { Grouping: 'Контрагент'; DeclaredResourceUnit: '(Упр)'; InputBasis: 'NormalFenixManagementDatedOpeningAndContiguousMonths'
  PresentationBasis: 'CurrentGbaClrDecimal'; SourceParityVerified: false; EffectiveSourcePeriodsVerified: false; AppliesFxConversion: false }
export type ManagementBalanceCapabilities = Basis & { Version: 1; SourceIdentity: Identity; ReportName: string; Periodicity: 'Month' | 'Quarter'
  ScopeKind: 'TwoCurrentGbaCalendarBalanceEndpoints'; Filters: ['Period']; Columns: Array<typeof MANAGEMENT_BALANCE_COLUMNS[number]>
  RuntimeImplemented: boolean; InputAvailability: 'CheckedByPreview'; RequiresCompleteNormalPublications: true }
export type ManagementBalanceRequest = { Version: 1; SourceIdentity: Identity; Period: string }
export type ManagementBalanceCell = { Key: typeof MANAGEMENT_BALANCE_COLUMNS[number]['Key']; Value: string | null; Available: boolean
  ExactValue: { Numerator: string; Denominator: string } | null; FormattedValue: string | null }
export type ManagementBalanceInput = { ThroughExclusive: string; Available: boolean; DatedOpeningComplete: boolean
  MovementPrefixComplete: boolean; PhysicalRows: number | null; Code: string }
export type ManagementBalanceReport = Basis & { Version: 1; SourceIdentity: Identity; Period: string; Periodicity: 'Month' | 'Quarter'
  CurrentThroughExclusive: string; PreviousThroughExclusive: string; Columns: Array<typeof MANAGEMENT_BALANCE_COLUMNS[number]>
  Rows: Array<{ Key: string; Caption: string | null; NameAvailable: boolean; Cells: ManagementBalanceCell[] }>; Totals: ManagementBalanceCell[]
  Inputs: { Current: ManagementBalanceInput; Previous: ManagementBalanceInput }; Complete: boolean; HasRows: boolean; CounterpartyNamesComplete: boolean
  Code: 'available' | 'published_empty' | 'balance_input_unavailable' | 'decimal_projection_unavailable'
  Proof: { OpeningRunId: string | null; OpeningPassSha256: string | null; BusinessBoundary: string | null; SourceIdentitySha256: string | null
    MovementGenerations: Array<{ Month: string; RunId: string; PassSha256: string }>; InputProofSha256: string; CounterpartyNamesSha256: string; OurSnapshotVerified: true }
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const code = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value
const guid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
function identity(value: unknown, kind: ManagementBalanceKind): boolean { return record(value)
  && Object.entries(MANAGEMENT_BALANCE_DEFINITIONS[kind].SourceIdentity).every(([key, expected]) => value[key] === expected) }
export function managementBalanceKind(value: { SourceIdentity: unknown }): ManagementBalanceKind | null {
  return identity(value.SourceIdentity, 'monthlyReceivables') ? 'monthlyReceivables'
    : identity(value.SourceIdentity, 'quarterlyManagementPayables') ? 'quarterlyManagementPayables' : null
}
function columns(value: unknown): boolean { return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(MANAGEMENT_BALANCE_COLUMNS[index]).every(([key, expected]) => column[key] === expected)) }
function basis(value: Record<string, unknown>): boolean { return value.Grouping === 'Контрагент' && value.DeclaredResourceUnit === '(Упр)'
  && value.InputBasis === 'NormalFenixManagementDatedOpeningAndContiguousMonths' && value.PresentationBasis === 'CurrentGbaClrDecimal'
  && value.SourceParityVerified === false && value.EffectiveSourcePeriodsVerified === false && value.AppliesFxConversion === false }
export function managementBalanceCatalogueKind(report: ReportCatalogueEntry): ManagementBalanceKind | null {
  for (const kind of ['monthlyReceivables', 'quarterlyManagementPayables'] as const) {
    const source = MANAGEMENT_BALANCE_DEFINITIONS[kind].SourceIdentity
    const matches = report.Sources.filter(item => item.World === source.World && item.SourceId === source.SourceId)
    if (report.Id === `custom:fenix:${source.SourceId}` && matches.length === 1
      && (matches[0].DefinitionSha256 === null || matches[0].DefinitionSha256 === source.DefinitionSha256)) return kind
  }
  return null
}
export function isManagementBalanceCapabilities(value: unknown, expectedKind?: ManagementBalanceKind): value is ManagementBalanceCapabilities {
  if (!record(value) || value.Version !== 1 || !basis(value) || !columns(value.Columns)) return false
  const kind = managementBalanceKind({ SourceIdentity: value.SourceIdentity })
  return kind !== null && (!expectedKind || kind === expectedKind) && value.ReportName === MANAGEMENT_BALANCE_DEFINITIONS[kind].ReportName
    && value.Periodicity === MANAGEMENT_BALANCE_DEFINITIONS[kind].Periodicity && value.ScopeKind === 'TwoCurrentGbaCalendarBalanceEndpoints'
    && Array.isArray(value.Filters) && value.Filters.length === 1 && value.Filters[0] === 'Period' && typeof value.RuntimeImplemented === 'boolean'
    && value.InputAvailability === 'CheckedByPreview' && value.RequiresCompleteNormalPublications === true
}
export function managementBalancePeriodError(kind: ManagementBalanceKind, period: string): string | null {
  const quarterly = kind === 'quarterlyManagementPayables'
  const valid = quarterly ? /^\d{4}-Q[1-4]$/.test(period) : /^\d{4}-(?:0[1-9]|1[0-2])$/.test(period)
  return !valid || period <= (quarterly ? '0001-Q1' : '0001-01') || period >= (quarterly ? '7999-Q4' : '7999-12')
    ? 'Оберіть допустимий місяць або квартал для двох меж заборгованості.' : null
}
export function initialManagementBalancePeriod(kind: ManagementBalanceKind, month: string): string {
  return kind === 'quarterlyManagementPayables' && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)
    ? `${month.slice(0, 4)}-Q${Math.floor((Number(month.slice(5)) - 1) / 3) + 1}` : month
}
/** Only calendar endpoints are derived here; every financial value comes from the server. */
export function managementBalanceEndpoints(kind: ManagementBalanceKind, period: string): Pick<ManagementBalanceReport, 'CurrentThroughExclusive' | 'PreviousThroughExclusive'> {
  if (managementBalancePeriodError(kind, period)) throw invalidManagementBalance()
  const quarterly = kind === 'quarterlyManagementPayables', month = quarterly ? (Number(period.slice(6)) - 1) * 3 + 1 : Number(period.slice(5))
  const index = Number(period.slice(0, 4)) * 12 + month - 1
  return { CurrentThroughExclusive: monthStart(index + (quarterly ? 3 : 1)), PreviousThroughExclusive: monthStart(index) }
}
function monthStart(index: number): string { return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01` }
export function createManagementBalanceRequest(capability: ManagementBalanceCapabilities, period: string): ManagementBalanceRequest {
  if (!isManagementBalanceCapabilities(capability) || !capability.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const kind = managementBalanceKind(capability)!, error = managementBalancePeriodError(kind, period)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...MANAGEMENT_BALANCE_DEFINITIONS[kind].SourceIdentity }, Period: period }
}
function exact(value: unknown): boolean { return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
  && value.Numerator.length <= 20000 && value.Denominator.length <= 20000 && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator)
  && /^[1-9]\d*$/.test(value.Denominator) && (value.Numerator !== '0' || value.Denominator === '1') }
function cells(value: unknown): value is ManagementBalanceCell[] {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== MANAGEMENT_BALANCE_COLUMNS[index].Key || typeof cell.Available !== 'boolean'
      || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.ExactValue === null && cell.FormattedValue === null
    return exact(cell.ExactValue) && decimal(cell.Value) && decimal(cell.FormattedValue) && (index !== 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function input(value: unknown, endpoint: string): value is ManagementBalanceInput {
  if (!record(value) || value.ThroughExclusive !== endpoint || typeof value.Available !== 'boolean' || typeof value.DatedOpeningComplete !== 'boolean'
    || typeof value.MovementPrefixComplete !== 'boolean' || !code(value.Code)) return false
  return value.Available ? value.DatedOpeningComplete && value.MovementPrefixComplete && count(value.PhysicalRows) : value.PhysicalRows === null
}
function groups(value: unknown): value is ManagementBalanceReport['Rows'] {
  if (!Array.isArray(value) || value.length > 200000) return false
  const seen = new Set<string>()
  return value.every(row => {
    if (!record(row) || !hash(row.Key) || seen.has(row.Key) || typeof row.NameAvailable !== 'boolean' || !cells(row.Cells)) return false
    seen.add(row.Key)
    return row.NameAvailable ? typeof row.Caption === 'string' && row.Caption.trim().length > 0 && row.Caption.length <= 4096 : row.Caption === null
  })
}
function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' || value >= '8000-01-01') return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}
function proof(value: unknown, report: ManagementBalanceReport): boolean {
  if (!record(value) || value.OurSnapshotVerified !== true || !hash(value.InputProofSha256) || !hash(value.CounterpartyNamesSha256)
    || !(value.OpeningRunId === null || guid(value.OpeningRunId)) || !(value.OpeningPassSha256 === null || hash(value.OpeningPassSha256))
    || !(value.BusinessBoundary === null || date(value.BusinessBoundary)) || !(value.SourceIdentitySha256 === null || hash(value.SourceIdentitySha256))
    || !Array.isArray(value.MovementGenerations) || value.MovementGenerations.length > 96000) return false
  const opening = hash(value.OpeningPassSha256) && guid(value.OpeningRunId) && date(value.BusinessBoundary) && hash(value.SourceIdentitySha256)
  if (!opening) return !report.Inputs.Current.DatedOpeningComplete && !report.Inputs.Previous.DatedOpeningComplete
    && value.OpeningPassSha256 === null && value.BusinessBoundary === null && value.SourceIdentitySha256 === null && value.MovementGenerations.length === 0
  if ((value.BusinessBoundary as string) > report.PreviousThroughExclusive) return false
  const boundary = value.BusinessBoundary as string, begin = Number(boundary.slice(0, 4)) * 12 + Number(boundary.slice(5, 7)) - 1
  const end = Number(report.CurrentThroughExclusive.slice(0, 4)) * 12 + Number(report.CurrentThroughExclusive.slice(5, 7)) - 1
  const seen = new Set<string>()
  const previousEnd = Number(report.PreviousThroughExclusive.slice(0, 4)) * 12 + Number(report.PreviousThroughExclusive.slice(5, 7)) - 1
  const required = report.Inputs.Current.MovementPrefixComplete ? end - begin : report.Inputs.Previous.MovementPrefixComplete ? previousEnd - begin : 0
  if (value.MovementGenerations.length > end - begin || value.MovementGenerations.length < required) return false
  return value.MovementGenerations.every((generation, index) => {
    if (!record(generation) || generation.Month !== monthStart(begin + index).slice(0, 7) || !guid(generation.RunId)
      || generation.RunId.toLowerCase() === (value.OpeningRunId as string).toLowerCase()
      || seen.has(generation.RunId.toLowerCase()) || !hash(generation.PassSha256)) return false
    seen.add(generation.RunId.toLowerCase()); return true
  })
}
function envelope(value: unknown, request: ManagementBalanceRequest): value is ManagementBalanceReport {
  const kind = managementBalanceKind(request)
  if (!kind) return false
  const endpoints = managementBalanceEndpoints(kind, request.Period)
  return record(value) && value.Version === 1 && identity(value.SourceIdentity, kind) && value.Period === request.Period
    && value.Periodicity === MANAGEMENT_BALANCE_DEFINITIONS[kind].Periodicity && basis(value) && columns(value.Columns)
    && value.CurrentThroughExclusive === endpoints.CurrentThroughExclusive && value.PreviousThroughExclusive === endpoints.PreviousThroughExclusive
    && record(value.Inputs) && input(value.Inputs.Current, endpoints.CurrentThroughExclusive) && input(value.Inputs.Previous, endpoints.PreviousThroughExclusive)
    && cells(value.Totals) && groups(value.Rows) && typeof value.Complete === 'boolean' && typeof value.HasRows === 'boolean'
    && typeof value.CounterpartyNamesComplete === 'boolean' && hash(value.RequestSha256) && hash(value.ResultSha256)
    && isManagementReturnsDocumentUrl(value.DocumentURL) && isManagementReturnsDocumentUrl(value.PdfDocumentURL)
}
/** Bind the original form, explicit endpoints, row-free lineage and availability without browser calculations. */
export function normalizeManagementBalanceReport(value: unknown, request: ManagementBalanceRequest): ManagementBalanceReport {
  if (!envelope(value, request) || !proof(value.Proof, value)) throw invalidManagementBalance()
  if (value.Complete && !(value.Inputs.Current.Available && value.Inputs.Previous.Available) || value.HasRows !== (value.Rows.length > 0)
    || value.CounterpartyNamesComplete !== value.Rows.every(row => row.NameAvailable)) throw invalidManagementBalance()
  const allCells = [value.Totals, ...value.Rows.map(row => row.Cells)]
  if (!value.Inputs.Current.Available && allCells.some(row => row[0].Available)
    || !value.Inputs.Previous.Available && allCells.some(row => row[1].Available || row[2].Available)
    || !value.Complete && allCells.some(row => row[3].Available)) throw invalidManagementBalance()
  if (value.Complete && !value.HasRows && (value.Totals.some(cell => cell.Value !== null || cell.ExactValue !== null)
    || !value.Totals[0].Available || !value.Totals[1].Available || value.Totals[2].Available || value.Totals[3].Available)) throw invalidManagementBalance()
  const expected = !value.Complete ? 'balance_input_unavailable' : !value.HasRows ? 'published_empty'
    : allCells.some(row => row.some(cell => !cell.Available)) ? 'decimal_projection_unavailable' : 'available'
  if (value.Code !== expected) throw invalidManagementBalance()
  return value
}
export function invalidManagementBalance() { return new Error('Сервер повернув непідтверджений результат заборгованості або інші межі періоду.') }
