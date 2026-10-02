import type { ReportCatalogueEntry } from '../types'

export const OVERDUE_RECEIVABLES_SOURCE = { World: 'fenix', SourceId: '0xb4b500055d78a52511ddfc172c5097f5',
  DefinitionSha256: '965989632ea9f02e9801cdbf6a21620bceb1b53558f63b63dba72307cd496821' } as const
export const OVERDUE_RECEIVABLES_NAME = 'Просроченная дебиторская задолженность'
export const OVERDUE_RECEIVABLES_INPUT_BASIS = 'CompleteOurDocumentSettlementBalancesAndOurEffectiveCurrencyRates'
export const OVERDUE_RECEIVABLES_PRESENTATION_BASIS = 'CurrentGbaPerGrainNumber15Scale2AwayFromZero'
export const OVERDUE_RECEIVABLES_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
export const OVERDUE_RECEIVABLES_FX_BASIS = 'OurCommercialUnitsPerEurStrictlyBeforeMonthEndpoint'
export type OverdueReceivablesCapabilities = {
  Periodicity: 'Month'; ManagementCurrency: 'EUR'; FxBasis: typeof OVERDUE_RECEIVABLES_FX_BASIS
  Version: 1; SourceIdentity: typeof OVERDUE_RECEIVABLES_SOURCE; ReportName: typeof OVERDUE_RECEIVABLES_NAME
  ScopeKind: 'TwoExplicitCurrentGbaCalendarMonths'; InputBasis: typeof OVERDUE_RECEIVABLES_INPUT_BASIS
  PresentationBasis: typeof OVERDUE_RECEIVABLES_PRESENTATION_BASIS; Columns: Array<typeof OVERDUE_RECEIVABLES_COLUMNS[number]>
  RuntimeImplemented: boolean; RequiresCompleteNormalPublications: true; InputAvailability: 'CheckedByPreview'
  SourceParityVerified: false; EffectiveSourcePeriodsVerified: false
}
export type OverdueReceivablesRequest = { Version: 1; SourceIdentity: typeof OVERDUE_RECEIVABLES_SOURCE; Month: string }
export type OverdueReceivablesExactNumber = { Numerator: string; Denominator: string }
export type OverdueReceivablesInput = {
  CompleteBalanceCoverage: boolean; OpeningPhysicalRows: number; MovementPhysicalRows: number
  BalanceGrains: number; PositiveGrains: number; UnknownTermsGrains: number; Code: string
}
export type OverdueReceivablesProof = {
  OpeningRunId: string | null; OpeningPassSha256: string | null; BusinessBoundary: string | null
  MovementGenerations: Array<{ ThroughExclusive: string; RunId: string; PassSha256: string }>; InputProofSha256: string; OurSnapshotVerified: true
}
export type OverdueReceivablesCell = {
  Key: typeof OVERDUE_RECEIVABLES_COLUMNS[number]['Key']; Value: string | null; Available: boolean
  ExactValue: OverdueReceivablesExactNumber | null; FormattedValue: string | null
}
export type OverdueReceivablesGroup = { CounterpartyReference: string; NameAvailable: boolean; CounterpartyName: string | null; Cells: OverdueReceivablesCell[] }
export type OverdueReceivablesReport = {
  Version: 1; SourceIdentity: typeof OVERDUE_RECEIVABLES_SOURCE; Month: string
  CurrentPeriod: { From: string; ThroughExclusive: string }; PreviousPeriod: { From: string; ThroughExclusive: string }
  Columns: Array<typeof OVERDUE_RECEIVABLES_COLUMNS[number]>
  Cells: OverdueReceivablesCell[]; Rows: OverdueReceivablesGroup[]
  Inputs: { Current: OverdueReceivablesInput; Previous: OverdueReceivablesInput }; Complete: boolean; HasRows: boolean
  Code: 'available' | 'published_empty' | 'input_not_available' | 'decimal_projection_unavailable'
  InputBasis: typeof OVERDUE_RECEIVABLES_INPUT_BASIS; PresentationBasis: typeof OVERDUE_RECEIVABLES_PRESENTATION_BASIS
  ManagementCurrency: 'EUR'; FxBasis: typeof OVERDUE_RECEIVABLES_FX_BASIS
  Proof: OverdueReceivablesProof; SourceParityVerified: false; EffectiveSourcePeriodsVerified: false
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const guid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
export function isOverdueReceivablesDocumentUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value === '') return true
  if (value !== value.trim() || /[\u0000-\u001f\u007f\\]/.test(value)
    || !/^https?:\/\//i.test(value) && (!value.startsWith('/') || value.startsWith('//'))) return false
  try {
    const url = new URL(value, 'https://gba.invalid')
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
  } catch { return false }
}
function date(value: unknown): value is string {
  if (typeof value !== 'string' || value < '0001-01-01' || !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}
function identity(value: unknown): boolean { return record(value) && Object.entries(OVERDUE_RECEIVABLES_SOURCE).every(([key, expected]) => value[key] === expected) }
function columns(value: unknown): boolean { return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(OVERDUE_RECEIVABLES_COLUMNS[index]).every(([key, expected]) => column[key] === expected)) }
function basis(value: Record<string, unknown>): boolean { return value.InputBasis === OVERDUE_RECEIVABLES_INPUT_BASIS
  && value.ManagementCurrency === 'EUR' && value.FxBasis === OVERDUE_RECEIVABLES_FX_BASIS
  && value.PresentationBasis === OVERDUE_RECEIVABLES_PRESENTATION_BASIS && value.SourceParityVerified === false && value.EffectiveSourcePeriodsVerified === false }
export function isOverdueReceivablesCatalogueEntry(report: ReportCatalogueEntry): boolean {
  const matches = report.Sources.filter(source => source.World === OVERDUE_RECEIVABLES_SOURCE.World && source.SourceId === OVERDUE_RECEIVABLES_SOURCE.SourceId)
  return report.Id === `custom:fenix:${OVERDUE_RECEIVABLES_SOURCE.SourceId}` && matches.length === 1
    && (matches[0].DefinitionSha256 === null || matches[0].DefinitionSha256 === OVERDUE_RECEIVABLES_SOURCE.DefinitionSha256)
}
export function isOverdueReceivablesCapabilities(value: unknown): value is OverdueReceivablesCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && value.ReportName === OVERDUE_RECEIVABLES_NAME
    && value.Periodicity === 'Month' && value.ScopeKind === 'TwoExplicitCurrentGbaCalendarMonths' && columns(value.Columns) && basis(value)
    && typeof value.RuntimeImplemented === 'boolean' && value.RequiresCompleteNormalPublications === true && value.InputAvailability === 'CheckedByPreview'
}
export function overdueReceivablesMonthError(month: string): string | null {
  return !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month <= '0001-01' || month >= '7999-12'
    ? 'Оберіть допустимий місяць із поточним і попереднім періодами.' : null
}
export function overdueReceivablesPeriods(month: string): Pick<OverdueReceivablesReport, 'CurrentPeriod' | 'PreviousPeriod'> {
  if (overdueReceivablesMonthError(month)) throw new Error('Некоректний місячний період заборгованості.')
  return { CurrentPeriod: { From: calendarMonthDate(month, 0), ThroughExclusive: calendarMonthDate(month, 1) },
    PreviousPeriod: { From: calendarMonthDate(month, -1), ThroughExclusive: calendarMonthDate(month, 0) } }
}
/** Parent boundaries may be the adjacent month outside the selectable request domain. */
function calendarMonthDate(month: string, offset: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1 + offset
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01`
}
export function createOverdueReceivablesRequest(capability: OverdueReceivablesCapabilities, month: string): OverdueReceivablesRequest {
  if (!isOverdueReceivablesCapabilities(capability) || !capability.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = overdueReceivablesMonthError(month); if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...OVERDUE_RECEIVABLES_SOURCE }, Month: month }
}
function exact(value: unknown): value is OverdueReceivablesExactNumber {
  return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
    && value.Numerator.length <= 20000 && value.Denominator.length <= 20000
    && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator) && /^[1-9]\d*$/.test(value.Denominator)
    && (value.Numerator !== '0' || value.Denominator === '1')
}
function input(value: unknown): value is OverdueReceivablesInput {
  if (!record(value) || typeof value.CompleteBalanceCoverage !== 'boolean' || typeof value.Code !== 'string' || !value.Code.trim()
    || ![value.OpeningPhysicalRows, value.MovementPhysicalRows, value.BalanceGrains, value.PositiveGrains, value.UnknownTermsGrains].every(count)) return false
  return (value.PositiveGrains as number) <= (value.BalanceGrains as number) && (value.UnknownTermsGrains as number) <= (value.PositiveGrains as number)
    && (value.Code !== 'available' || value.CompleteBalanceCoverage && value.UnknownTermsGrains === 0)
}
function cells(value: unknown): boolean {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== OVERDUE_RECEIVABLES_COLUMNS[index].Key || typeof cell.Available !== 'boolean'
      || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.ExactValue === null && cell.FormattedValue === null
    return exact(cell.ExactValue) && decimal(cell.Value) && decimal(cell.FormattedValue) && (index !== 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function groups(value: unknown): value is OverdueReceivablesGroup[] {
  if (!Array.isArray(value) || value.length > 200000) return false
  const seen = new Set<string>()
  return value.every(row => {
    if (!record(row) || typeof row.CounterpartyReference !== 'string' || !/^[0-9A-F]{32}$/.test(row.CounterpartyReference)
      || seen.has(row.CounterpartyReference) || typeof row.NameAvailable !== 'boolean' || !cells(row.Cells)) return false
    seen.add(row.CounterpartyReference)
    return row.NameAvailable ? typeof row.CounterpartyName === 'string' && row.CounterpartyName.trim().length > 0 : row.CounterpartyName === null
  })
}
function proof(value: unknown, report: OverdueReceivablesReport): value is OverdueReceivablesProof {
  if (!record(value) || value.OurSnapshotVerified !== true || !hash(value.InputProofSha256)
    || !(value.OpeningRunId === null || guid(value.OpeningRunId)) || !(value.OpeningPassSha256 === null || hash(value.OpeningPassSha256))
    || !(value.BusinessBoundary === null || date(value.BusinessBoundary)) || !Array.isArray(value.MovementGenerations)) return false
  const covered = report.Inputs.Current.CompleteBalanceCoverage || report.Inputs.Previous.CompleteBalanceCoverage
  if (covered && (!guid(value.OpeningRunId) || !hash(value.OpeningPassSha256) || !date(value.BusinessBoundary)
    || value.BusinessBoundary > report.PreviousPeriod.ThroughExclusive)) return false
  const generations = value.MovementGenerations
  if (new Set(generations.map(item => record(item) ? item.RunId : null)).size !== generations.length) return false
  for (const [index, item] of generations.entries()) {
    if (!record(item) || !guid(item.RunId) || !hash(item.PassSha256) || !date(item.ThroughExclusive) || !item.ThroughExclusive.endsWith('-01')
      || item.ThroughExclusive > report.CurrentPeriod.ThroughExclusive) return false
    if (index > 0 && calendarMonthDate(item.ThroughExclusive.slice(0, 7), -1) !== (generations[index - 1] as { ThroughExclusive: string }).ThroughExclusive) return false
  }
  if (generations.length && (!guid(value.OpeningRunId) || !hash(value.OpeningPassSha256) || !date(value.BusinessBoundary)
    || (generations[0] as { ThroughExclusive: string }).ThroughExclusive !== calendarMonthDate(value.BusinessBoundary.slice(0, 7), 1))) return false
  return !covered || generations.length > 0 && (generations.at(-1) as { ThroughExclusive: string }).ThroughExclusive === report.CurrentPeriod.ThroughExclusive
}
function scopeMatches(value: Record<string, unknown>, month: string): boolean {
  const periods = overdueReceivablesPeriods(month)
  return value.Month === month && record(value.CurrentPeriod) && record(value.PreviousPeriod)
    && Object.entries(periods.CurrentPeriod).every(([key, expected]) => (value.CurrentPeriod as Record<string, unknown>)[key] === expected)
    && Object.entries(periods.PreviousPeriod).every(([key, expected]) => (value.PreviousPeriod as Record<string, unknown>)[key] === expected)
}
function envelope(value: unknown, request: OverdueReceivablesRequest): value is OverdueReceivablesReport {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && scopeMatches(value, request.Month) && columns(value.Columns) && basis(value)
    && record(value.Inputs) && input(value.Inputs.Current) && input(value.Inputs.Previous) && cells(value.Cells) && groups(value.Rows)
    && typeof value.Complete === 'boolean' && typeof value.HasRows === 'boolean' && hash(value.RequestSha256) && hash(value.ResultSha256)
    && isOverdueReceivablesDocumentUrl(value.DocumentURL) && isOverdueReceivablesDocumentUrl(value.PdfDocumentURL)
}
/** Request scope and coverage only: no balances, ratios or currency conversions are calculated in the browser. */
export function normalizeOverdueReceivablesReport(value: unknown, request: OverdueReceivablesRequest): OverdueReceivablesReport {
  if (!envelope(value, request) || !proof(value.Proof, value)) throw invalid()
  const current = value.Inputs.Current, previous = value.Inputs.Previous
  const complete = current.CompleteBalanceCoverage && previous.CompleteBalanceCoverage && current.Code === 'available' && previous.Code === 'available'
  if (value.Complete !== complete || value.Complete && !value.HasRows && (value.Rows.length > 0 || value.Cells.slice(0, 2).some(cell => cell.Value !== null || cell.ExactValue !== null))) throw invalid()
  if ((!current.CompleteBalanceCoverage || current.Code !== 'available') && value.Cells[0].Available
    || (!previous.CompleteBalanceCoverage || previous.Code !== 'available') && value.Cells[1].Available) throw invalid()
  const expected = !value.Complete ? 'input_not_available' : !value.HasRows ? 'published_empty'
    : value.Cells.some(cell => !cell.Available) || value.Rows.some(row => row.Cells.some(cell => !cell.Available)) ? 'decimal_projection_unavailable' : 'available'
  if (value.Code !== expected) throw invalid()
  return value
}
function invalid() { return new Error('Сервер повернув некоректний результат заборгованості або інший місячний період.') }
