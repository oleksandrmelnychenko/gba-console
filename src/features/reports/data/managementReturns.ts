import type { ReportCatalogueEntry } from '../types'

export const MANAGEMENT_RETURNS_SOURCE = { World: 'fenix', SourceId: '0xb4b500055d78a52511ddfe9d4aaca7ff',
  DefinitionSha256: '1bb375a387fbfc4532445e5e0f139e4502cfa083062ae8cdce26ee746bdd4954' } as const
export const MANAGEMENT_RETURNS_NAME = 'Возвраты проданных товаров'
export const MANAGEMENT_RETURNS_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
export type ManagementReturnsPeriod = { From: string; ThroughExclusive: string }
export type ManagementReturnsWindows = { CurrentPeriod: ManagementReturnsPeriod; PreviousPeriod: ManagementReturnsPeriod }
type ManagementReturnsBasis = {
  Grouping: 'Контрагент'; ManagementCurrency: 'Управлінська валюта'; InputBasis: 'NormalFenixSales22'
  RawVisibilityPolicy: 'DirectRegisterNoActivePredicate'; AgreementOwnerPolicy: 'PerQueryPeriodObservedAgreementOwner'
  EffectiveSourcePeriodsVerified: false; SourceParityVerified: false; NativeCurrencyMappingVerified: false; AppliesFxConversion: false
}
export type ManagementReturnsCapabilities = ManagementReturnsBasis & {
  Version: 1; SourceIdentity: typeof MANAGEMENT_RETURNS_SOURCE; ReportName: typeof MANAGEMENT_RETURNS_NAME
  DefaultPeriodicity: 'Month'; ScopeKind: 'TwoExplicitHalfOpenCurrentGbaCalendarWindows'
  Columns: Array<typeof MANAGEMENT_RETURNS_COLUMNS[number]>; Filters: ['CurrentPeriod', 'PreviousPeriod']
  RuntimeImplemented: boolean; RequiresCompleteNormalPublications: true; InputAvailability: 'CheckedByPreview'
}
export type ManagementReturnsRequest = ManagementReturnsWindows & { Version: 1; SourceIdentity: typeof MANAGEMENT_RETURNS_SOURCE }
export type ManagementReturnsCell = {
  Key: typeof MANAGEMENT_RETURNS_COLUMNS[number]['Key']; Value: string | null; Available: boolean
  ExactValue: { Numerator: string; Denominator: string } | null; FormattedValue: string | null
}
export type ManagementReturnsGroup = { Key: string; Caption: string | null; NameAvailable: boolean; SourceNull: boolean; Cells: ManagementReturnsCell[] }
export type ManagementReturnsInput = { Available: boolean; IncludedRows: number | null; Code: string }
export type ManagementReturnsPublication = { BusinessMonth: string; RunId: string | null; Available: boolean
  PhysicalRows: number | null; PagesPerPass: number | null; CompletePassSha256: string | null; Code: string }
export type ManagementReturnsReport = ManagementReturnsBasis & ManagementReturnsWindows & {
  Version: 1; SourceIdentity: typeof MANAGEMENT_RETURNS_SOURCE; Columns: Array<typeof MANAGEMENT_RETURNS_COLUMNS[number]>
  Rows: ManagementReturnsGroup[]; Totals: ManagementReturnsCell[]; Inputs: { Current: ManagementReturnsInput; Previous: ManagementReturnsInput }
  Complete: boolean; HasRows: boolean; CounterpartyNamesComplete: boolean
  Code: 'available' | 'query_empty' | 'raw_sales_owner_query_input_unavailable' | 'decimal_projection_unavailable'
  PresentationBasis: 'CurrentGbaClrDecimal'; ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string
  Proof: { Publications: ManagementReturnsPublication[]; ObservationSha256: string; CounterpartyNamesSha256: string; SnapshotVerified: true }
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const code = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim()
const guid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
function identity(value: unknown): boolean { return record(value) && Object.entries(MANAGEMENT_RETURNS_SOURCE).every(([key, expected]) => value[key] === expected) }
function columns(value: unknown): boolean { return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(MANAGEMENT_RETURNS_COLUMNS[index]).every(([key, expected]) => column[key] === expected)) }
function basis(value: Record<string, unknown>): boolean { return value.Grouping === 'Контрагент' && value.ManagementCurrency === 'Управлінська валюта'
  && value.InputBasis === 'NormalFenixSales22' && value.RawVisibilityPolicy === 'DirectRegisterNoActivePredicate'
  && value.AgreementOwnerPolicy === 'PerQueryPeriodObservedAgreementOwner' && value.EffectiveSourcePeriodsVerified === false
  && value.SourceParityVerified === false && value.NativeCurrencyMappingVerified === false && value.AppliesFxConversion === false }
export function isManagementReturnsCatalogueEntry(report: ReportCatalogueEntry): boolean {
  const sources = report.Sources.filter(source => source.World === MANAGEMENT_RETURNS_SOURCE.World && source.SourceId === MANAGEMENT_RETURNS_SOURCE.SourceId)
  return report.Id === `custom:fenix:${MANAGEMENT_RETURNS_SOURCE.SourceId}` && sources.length === 1
    && (sources[0].DefinitionSha256 === null || sources[0].DefinitionSha256 === MANAGEMENT_RETURNS_SOURCE.DefinitionSha256)
}
export function isManagementReturnsCapabilities(value: unknown): value is ManagementReturnsCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && value.ReportName === MANAGEMENT_RETURNS_NAME
    && value.DefaultPeriodicity === 'Month' && value.ScopeKind === 'TwoExplicitHalfOpenCurrentGbaCalendarWindows'
    && basis(value) && columns(value.Columns) && Array.isArray(value.Filters) && value.Filters.join('|') === 'CurrentPeriod|PreviousPeriod'
    && typeof value.RuntimeImplemented === 'boolean' && value.RequiresCompleteNormalPublications === true && value.InputAvailability === 'CheckedByPreview'
}
/** Calendar validation only: no timezone conversion or financial arithmetic occurs here. */
function calendar(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value)
  if (!match) return null
  const canonical = `${match[1]}:${match[2] ?? '00'}.${(match[3] ?? '').padEnd(3, '0')}`
  if (canonical < '0001-01-01T00:00:00.000' || canonical > '7999-12-01T00:00:00.000') return null
  const parsed = Date.parse(`${canonical}Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 23) === canonical ? canonical : null
}
function period(value: unknown): ManagementReturnsPeriod | null {
  if (!record(value)) return null
  const from = calendar(value.From), through = calendar(value.ThroughExclusive)
  return from && through && from < through ? { From: from, ThroughExclusive: through } : null
}
export function managementReturnsWindowsError(windows: ManagementReturnsWindows): string | null {
  return period(windows.CurrentPeriod) && period(windows.PreviousPeriod) ? null
    : 'Оберіть точні початок і виключну кінцеву межу кожного локального періоду.'
}
function monthStart(index: number): string { return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01T00:00:00.000` }
export function initialManagementReturnsWindows(month: string): ManagementReturnsWindows {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month <= '0001-01' || month >= '7999-12')
    return { CurrentPeriod: { From: '', ThroughExclusive: '' }, PreviousPeriod: { From: '', ThroughExclusive: '' } }
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1
  return { CurrentPeriod: { From: monthStart(index), ThroughExclusive: monthStart(index + 1) },
    PreviousPeriod: { From: monthStart(index - 1), ThroughExclusive: monthStart(index) } }
}
export function createManagementReturnsRequest(capability: ManagementReturnsCapabilities, windows: ManagementReturnsWindows): ManagementReturnsRequest {
  if (!isManagementReturnsCapabilities(capability) || !capability.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const current = period(windows.CurrentPeriod), previous = period(windows.PreviousPeriod)
  if (!current || !previous) throw new Error(managementReturnsWindowsError(windows) ?? 'Некоректні локальні періоди.')
  return { Version: 1, SourceIdentity: { ...MANAGEMENT_RETURNS_SOURCE }, CurrentPeriod: current, PreviousPeriod: previous }
}
function exact(value: unknown): boolean { return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
  && value.Numerator.length <= 20000 && value.Denominator.length <= 20000 && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator)
  && /^[1-9]\d*$/.test(value.Denominator) && (value.Numerator !== '0' || value.Denominator === '1') }
function cells(value: unknown): value is ManagementReturnsCell[] {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== MANAGEMENT_RETURNS_COLUMNS[index].Key || typeof cell.Available !== 'boolean'
      || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.ExactValue === null && cell.FormattedValue === null
    return exact(cell.ExactValue) && decimal(cell.Value) && decimal(cell.FormattedValue) && (index !== 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function input(value: unknown): value is ManagementReturnsInput { return record(value) && typeof value.Available === 'boolean' && code(value.Code)
  && (value.Available ? count(value.IncludedRows) && value.Code === (value.IncludedRows === 0 ? 'query_empty' : 'available') : value.IncludedRows === null) }
function groups(value: unknown): value is ManagementReturnsGroup[] {
  if (!Array.isArray(value)) return false
  const seen = new Set<string>()
  return value.every(row => {
    if (!record(row) || !hash(row.Key) || seen.has(row.Key) || typeof row.SourceNull !== 'boolean' || typeof row.NameAvailable !== 'boolean' || !cells(row.Cells)) return false
    seen.add(row.Key)
    if (row.SourceNull) return row.NameAvailable && row.Caption === null
    return row.NameAvailable ? typeof row.Caption === 'string' && row.Caption.trim().length > 0 : row.Caption === null
  })
}
export function isManagementReturnsDocumentUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!value) return true
  for (const character of value) { const n = character.charCodeAt(0); if (n <= 31 || n === 127 || character === '\\') return false }
  if (value !== value.trim() || !/^https?:\/\//i.test(value) && (!value.startsWith('/') || value.startsWith('//'))) return false
  try { const url = new URL(value, 'https://gba.invalid'); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
function months(request: ManagementReturnsRequest): string[] {
  const result = new Set<string>()
  for (const window of [request.CurrentPeriod, request.PreviousPeriod]) {
    for (let index = Number(window.From.slice(0, 4)) * 12 + Number(window.From.slice(5, 7)) - 1;
      monthStart(index) < window.ThroughExclusive; index++) result.add(monthStart(index).slice(0, 10))
  }
  return [...result].sort()
}
function proof(value: unknown, request: ManagementReturnsRequest, inputs: ManagementReturnsReport['Inputs']): boolean {
  if (!record(value) || value.SnapshotVerified !== true || !hash(value.ObservationSha256) || !hash(value.CounterpartyNamesSha256)
    || !Array.isArray(value.Publications)) return false
  const expected = months(request), seen = new Set<string>()
  return value.Publications.length === expected.length && value.Publications.every((parent, index) => {
    if (!record(parent) || parent.BusinessMonth !== expected[index] || typeof parent.Available !== 'boolean' || !code(parent.Code)
      || !(parent.RunId === null || guid(parent.RunId)) || !(parent.PhysicalRows === null || count(parent.PhysicalRows))
      || !(parent.PagesPerPass === null || count(parent.PagesPerPass) && parent.PagesPerPass > 0)
      || !(parent.CompletePassSha256 === null || hash(parent.CompletePassSha256))) return false
    if (parent.RunId !== null) { if (seen.has(parent.RunId.toLowerCase())) return false; seen.add(parent.RunId.toLowerCase()) }
    if (parent.Available && (!guid(parent.RunId) || !count(parent.PhysicalRows) || !count(parent.PagesPerPass) || !hash(parent.CompletePassSha256))) return false
    const start = `${expected[index]}T00:00:00.000`, next = monthStart(Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)))
    return ([['Current', request.CurrentPeriod], ['Previous', request.PreviousPeriod]] as const).every(([name, window]) =>
      !inputs[name].Available || start >= window.ThroughExclusive || next <= window.From || parent.Available)
  })
}
function utc(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 23) === value.slice(0, 23) }
function envelope(value: unknown, request: ManagementReturnsRequest): value is ManagementReturnsReport {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && basis(value) && value.PresentationBasis === 'CurrentGbaClrDecimal'
    && columns(value.Columns) && record(value.CurrentPeriod) && record(value.PreviousPeriod)
    && value.CurrentPeriod.From === request.CurrentPeriod.From && value.CurrentPeriod.ThroughExclusive === request.CurrentPeriod.ThroughExclusive
    && value.PreviousPeriod.From === request.PreviousPeriod.From && value.PreviousPeriod.ThroughExclusive === request.PreviousPeriod.ThroughExclusive
    && record(value.Inputs) && input(value.Inputs.Current) && input(value.Inputs.Previous) && cells(value.Totals) && groups(value.Rows)
    && typeof value.Complete === 'boolean' && typeof value.HasRows === 'boolean' && typeof value.CounterpartyNamesComplete === 'boolean'
    && utc(value.ObservationStartedAtUtc) && utc(value.ObservationCompletedAtUtc) && value.ObservationStartedAtUtc <= value.ObservationCompletedAtUtc
    && hash(value.RequestSha256) && hash(value.ResultSha256) && isManagementReturnsDocumentUrl(value.DocumentURL) && isManagementReturnsDocumentUrl(value.PdfDocumentURL)
}
/** Validate bindings and availability; every financial number and displayed caption is supplied by the server. */
export function normalizeManagementReturnsReport(value: unknown, request: ManagementReturnsRequest): ManagementReturnsReport {
  if (!envelope(value, request) || !proof(value.Proof, request, value.Inputs)) throw invalidManagementReturns()
  if (value.Complete !== (value.Inputs.Current.Available && value.Inputs.Previous.Available) || value.HasRows !== (value.Rows.length > 0)
    || value.CounterpartyNamesComplete !== value.Rows.every(row => row.NameAvailable)) throw invalidManagementReturns()
  const allCells = [value.Totals, ...value.Rows.map(row => row.Cells)]
  if (!value.Inputs.Current.Available && allCells.some(row => row[0].Available)
    || !value.Inputs.Previous.Available && allCells.some(row => row[1].Available)) throw invalidManagementReturns()
  if (!value.Complete && allCells.some(row => row[3].Available)
    || !value.Inputs.Previous.Available && allCells.some(row => row[2].Available)) throw invalidManagementReturns()
  if (value.Complete && !value.HasRows && (value.Totals.some(cell => cell.Value !== null || cell.ExactValue !== null)
    || !value.Totals[0].Available || !value.Totals[1].Available || value.Totals[2].Available || value.Totals[3].Available)) throw invalidManagementReturns()
  const expected = !value.Complete ? 'raw_sales_owner_query_input_unavailable' : !value.HasRows ? 'query_empty'
    : allCells.some(row => row.some(cell => !cell.Available)) ? 'decimal_projection_unavailable' : 'available'
  if (value.Code !== expected) throw invalidManagementReturns()
  return value
}
export function invalidManagementReturns() { return new Error('Сервер повернув непідтверджений результат повернень або інші межі періодів.') }
