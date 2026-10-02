import { isManagementReturnsDocumentUrl } from './managementReturns'
import type { ReportCatalogueEntry } from '../types'

export const MANAGEMENT_ORDERS_SOURCE = { World: 'fenix', SourceId: '0xb4b500055d78a52511ddfe73b936bf96',
  DefinitionSha256: '5d30064ca3b41d06be5f135031c1cd0c195eb6dad0b45c2c54a26f02ca5f7e91' } as const
export const MANAGEMENT_ORDERS_ROUTE = '/report/constructors/orders-incoming-management'
export const MANAGEMENT_ORDERS_NAME = 'Оформлено заказов на сумму'
export const MANAGEMENT_ORDERS_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
export type ManagementOrdersPeriod = { From: string; ThroughExclusive: string }
export type ManagementOrdersWindows = { CurrentPeriod: ManagementOrdersPeriod; PreviousPeriod: ManagementOrdersPeriod }
type ManagementOrdersBasis = {
  Grouping: 'Контрагент'; ManagementCurrency: 'Управлінська валюта'; InputBasis: 'NormalFenixBuyerOrders27'
  DeclaredResourceUnit: '(Упр)'; RecordKindMappingBasis: 'SharedFenixNonDocumentSettlementIncoming0Outgoing1'
  NativeVirtualTableZeroSuppressionVerified: false; RawVisibilityPolicy: 'ActiveRecordKind0IncomingSignedResource'; AgreementOwnerPolicy: 'PerQueryPeriodObservedAgreementOwner'
  EffectiveSourcePeriodsVerified: false; SourceParityVerified: false; NativeCurrencyMappingVerified: false; AppliesFxConversion: false
}
export type ManagementOrdersCapabilities = ManagementOrdersBasis & {
  Version: 1; SourceIdentity: typeof MANAGEMENT_ORDERS_SOURCE; ReportName: typeof MANAGEMENT_ORDERS_NAME
  DefaultPeriodicity: 'Month'; ScopeKind: 'CurrentGbaMonthAndPreviousMonth'
  Columns: Array<typeof MANAGEMENT_ORDERS_COLUMNS[number]>; Filters: ['Month']
  RuntimeImplemented: boolean; RequiresCompleteNormalPublications: true; InputAvailability: 'CheckedByPreview'
}
export type ManagementOrdersRequest = { Version: 1; SourceIdentity: typeof MANAGEMENT_ORDERS_SOURCE; Month: string }
export type ManagementOrdersCell = {
  Key: typeof MANAGEMENT_ORDERS_COLUMNS[number]['Key']; Value: string | null; Available: boolean
  ExactValue: { Numerator: string; Denominator: string } | null; FormattedValue: string | null
}
export type ManagementOrdersGroup = { Key: string; Caption: string | null; NameAvailable: boolean; SourceNull: boolean; Cells: ManagementOrdersCell[] }
export type ManagementOrdersInput = { Available: boolean; IncludedRows: number | null; Code: string }
export type ManagementOrdersPublication = { BusinessMonth: string; RunId: string | null; Available: boolean
  PhysicalRows: number | null; PagesPerPass: number | null; CompletePassSha256: string | null; Code: string }
export type ManagementOrdersReport = ManagementOrdersBasis & ManagementOrdersWindows & {
  Version: 1; SourceIdentity: typeof MANAGEMENT_ORDERS_SOURCE; Month: string; Columns: Array<typeof MANAGEMENT_ORDERS_COLUMNS[number]>
  Rows: ManagementOrdersGroup[]; Totals: ManagementOrdersCell[]; Inputs: { Current: ManagementOrdersInput; Previous: ManagementOrdersInput }
  Complete: boolean; HasRows: boolean; CounterpartyNamesComplete: boolean
  Code: 'available' | 'query_empty' | 'order_incoming_query_input_unavailable' | 'decimal_projection_unavailable'
  PresentationBasis: 'CurrentGbaClrDecimal'; ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string
  Proof: { Publications: ManagementOrdersPublication[]; ObservationSha256: string; CounterpartyNamesSha256: string; SnapshotVerified: true }
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const code = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim()
const guid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
function identity(value: unknown): boolean { return record(value) && Object.entries(MANAGEMENT_ORDERS_SOURCE).every(([key, expected]) => value[key] === expected) }
function columns(value: unknown): boolean { return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(MANAGEMENT_ORDERS_COLUMNS[index]).every(([key, expected]) => column[key] === expected)) }
function basis(value: Record<string, unknown>): boolean { return value.Grouping === 'Контрагент' && value.ManagementCurrency === 'Управлінська валюта'
  && value.DeclaredResourceUnit === '(Упр)' && value.RecordKindMappingBasis === 'SharedFenixNonDocumentSettlementIncoming0Outgoing1'
  && value.NativeVirtualTableZeroSuppressionVerified === false && value.InputBasis === 'NormalFenixBuyerOrders27' && value.RawVisibilityPolicy === 'ActiveRecordKind0IncomingSignedResource'
  && value.AgreementOwnerPolicy === 'PerQueryPeriodObservedAgreementOwner' && value.EffectiveSourcePeriodsVerified === false
  && value.SourceParityVerified === false && value.NativeCurrencyMappingVerified === false && value.AppliesFxConversion === false }
export function isManagementOrdersCatalogueEntry(report: ReportCatalogueEntry): boolean {
  const sources = report.Sources.filter(source => source.World === MANAGEMENT_ORDERS_SOURCE.World && source.SourceId === MANAGEMENT_ORDERS_SOURCE.SourceId)
  return report.Id === `custom:fenix:${MANAGEMENT_ORDERS_SOURCE.SourceId}` && sources.length === 1
    && (sources[0].DefinitionSha256 === null || sources[0].DefinitionSha256 === MANAGEMENT_ORDERS_SOURCE.DefinitionSha256)
}
export function isManagementOrdersCapabilities(value: unknown): value is ManagementOrdersCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && value.ReportName === MANAGEMENT_ORDERS_NAME
    && value.DefaultPeriodicity === 'Month' && value.ScopeKind === 'CurrentGbaMonthAndPreviousMonth'
    && basis(value) && columns(value.Columns) && Array.isArray(value.Filters) && value.Filters.length === 1 && value.Filters[0] === 'Month'
    && typeof value.RuntimeImplemented === 'boolean' && value.RequiresCompleteNormalPublications === true && value.InputAvailability === 'CheckedByPreview'
}
/** Calendar validation only; server values are never calculated in the browser. */
export function managementOrdersMonthError(month: string): string | null {
  return typeof month !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month <= '0001-01' || month >= '7999-12'
    ? 'Оберіть допустимий місяць для порівняння замовлень.' : null
}
function monthStart(index: number): string {
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01T00:00:00.000`
}
export function managementOrdersWindows(month: string): ManagementOrdersWindows {
  if (managementOrdersMonthError(month)) throw invalidManagementOrders()
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1
  return { CurrentPeriod: { From: monthStart(index), ThroughExclusive: monthStart(index + 1) },
    PreviousPeriod: { From: monthStart(index - 1), ThroughExclusive: monthStart(index) } }
}
export function createManagementOrdersRequest(capability: ManagementOrdersCapabilities, month: string): ManagementOrdersRequest {
  if (!isManagementOrdersCapabilities(capability) || !capability.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = managementOrdersMonthError(month)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...MANAGEMENT_ORDERS_SOURCE }, Month: month }
}
function exact(value: unknown): boolean { return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
  && value.Numerator.length <= 20000 && value.Denominator.length <= 20000 && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator)
  && /^[1-9]\d*$/.test(value.Denominator) && (value.Numerator !== '0' || value.Denominator === '1') }
function cells(value: unknown): value is ManagementOrdersCell[] {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== MANAGEMENT_ORDERS_COLUMNS[index].Key || typeof cell.Available !== 'boolean'
      || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.ExactValue === null && cell.FormattedValue === null
    return exact(cell.ExactValue) && decimal(cell.Value) && decimal(cell.FormattedValue) && (index !== 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function input(value: unknown): value is ManagementOrdersInput { return record(value) && typeof value.Available === 'boolean' && code(value.Code)
  && (value.Available ? count(value.IncludedRows) && value.IncludedRows <= 200000 && value.Code === (value.IncludedRows === 0 ? 'query_empty' : 'available') : value.IncludedRows === null) }
function groups(value: unknown): value is ManagementOrdersGroup[] {
  if (!Array.isArray(value) || value.length > 400000) return false
  const seen = new Set<string>()
  return value.every(row => {
    if (!record(row) || !hash(row.Key) || seen.has(row.Key) || typeof row.SourceNull !== 'boolean' || typeof row.NameAvailable !== 'boolean' || !cells(row.Cells)) return false
    seen.add(row.Key)
    if (row.SourceNull) return row.NameAvailable && row.Caption === null
    return row.NameAvailable ? typeof row.Caption === 'string' && row.Caption.trim().length > 0 && row.Caption.length <= 4096 : row.Caption === null
  })
}
function months(request: ManagementOrdersRequest): string[] {
  const windows = managementOrdersWindows(request.Month)
  return [windows.PreviousPeriod.From.slice(0, 10), windows.CurrentPeriod.From.slice(0, 10)]
}
function proof(value: unknown, request: ManagementOrdersRequest, inputs: ManagementOrdersReport['Inputs']): boolean {
  if (!record(value) || value.SnapshotVerified !== true || !hash(value.ObservationSha256) || !hash(value.CounterpartyNamesSha256)
    || !Array.isArray(value.Publications)) return false
  const expected = months(request), windows = managementOrdersWindows(request.Month), seen = new Set<string>()
  return value.Publications.length === expected.length && value.Publications.every((parent, index) => {
    if (!record(parent) || parent.BusinessMonth !== expected[index] || typeof parent.Available !== 'boolean' || !code(parent.Code)
      || !(parent.RunId === null || guid(parent.RunId)) || !(parent.PhysicalRows === null || count(parent.PhysicalRows) && parent.PhysicalRows <= 200000)
      || !(parent.PagesPerPass === null || count(parent.PagesPerPass) && parent.PagesPerPass > 0 && parent.PagesPerPass <= 782)
      || !(parent.CompletePassSha256 === null || hash(parent.CompletePassSha256))) return false
    if (parent.RunId !== null) { if (seen.has(parent.RunId.toLowerCase())) return false; seen.add(parent.RunId.toLowerCase()) }
    if (parent.Available && (!guid(parent.RunId) || !count(parent.PhysicalRows) || !count(parent.PagesPerPass) || !hash(parent.CompletePassSha256))) return false
    if (count(parent.PhysicalRows) && count(parent.PagesPerPass) && parent.PagesPerPass !== Math.max(1, Math.ceil(parent.PhysicalRows / 256))) return false
    const start = `${expected[index]}T00:00:00.000`, next = monthStart(Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)))
    return ([['Current', windows.CurrentPeriod], ['Previous', windows.PreviousPeriod]] as const).every(([name, window]) => {
      const selected = inputs[name]
      return !selected.Available || start >= window.ThroughExclusive || next <= window.From
        || parent.Available && count(parent.PhysicalRows) && count(selected.IncludedRows) && selected.IncludedRows <= parent.PhysicalRows
    })
  })
}
function utc(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 23) === value.slice(0, 23) }
function envelope(value: unknown, request: ManagementOrdersRequest): value is ManagementOrdersReport {
  if (request.Version !== 1 || !identity(request.SourceIdentity) || managementOrdersMonthError(request.Month)) return false
  const windows = managementOrdersWindows(request.Month)
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && value.Month === request.Month && basis(value) && value.PresentationBasis === 'CurrentGbaClrDecimal'
    && columns(value.Columns) && record(value.CurrentPeriod) && record(value.PreviousPeriod)
    && value.CurrentPeriod.From === windows.CurrentPeriod.From && value.CurrentPeriod.ThroughExclusive === windows.CurrentPeriod.ThroughExclusive
    && value.PreviousPeriod.From === windows.PreviousPeriod.From && value.PreviousPeriod.ThroughExclusive === windows.PreviousPeriod.ThroughExclusive
    && record(value.Inputs) && input(value.Inputs.Current) && input(value.Inputs.Previous) && cells(value.Totals) && groups(value.Rows)
    && typeof value.Complete === 'boolean' && typeof value.HasRows === 'boolean' && typeof value.CounterpartyNamesComplete === 'boolean'
    && utc(value.ObservationStartedAtUtc) && utc(value.ObservationCompletedAtUtc) && value.ObservationStartedAtUtc <= value.ObservationCompletedAtUtc
    && hash(value.RequestSha256) && hash(value.ResultSha256) && isManagementReturnsDocumentUrl(value.DocumentURL) && isManagementReturnsDocumentUrl(value.PdfDocumentURL)
}
/** Validate bindings and availability; every financial number and displayed caption is supplied by the server. */
export function normalizeManagementOrdersReport(value: unknown, request: ManagementOrdersRequest): ManagementOrdersReport {
  if (!envelope(value, request) || !proof(value.Proof, request, value.Inputs)) throw invalidManagementOrders()
  if (value.Complete && !(value.Inputs.Current.Available && value.Inputs.Previous.Available) || value.HasRows !== (value.Rows.length > 0)
    || value.CounterpartyNamesComplete !== value.Rows.every(row => row.NameAvailable)) throw invalidManagementOrders()
  const allCells = [value.Totals, ...value.Rows.map(row => row.Cells)]
  if (!value.Inputs.Current.Available && allCells.some(row => row[0].Available)
    || !value.Inputs.Previous.Available && allCells.some(row => row[1].Available)) throw invalidManagementOrders()
  if (!value.Complete && allCells.some(row => row[3].Available)
    || !value.Inputs.Previous.Available && allCells.some(row => row[2].Available)) throw invalidManagementOrders()
  if (value.Complete && !value.HasRows && (value.Totals.some(cell => cell.Value !== null || cell.ExactValue !== null)
    || !value.Totals[0].Available || !value.Totals[1].Available || value.Totals[2].Available || value.Totals[3].Available)) throw invalidManagementOrders()
  const expected = !value.Complete ? 'order_incoming_query_input_unavailable' : !value.HasRows ? 'query_empty'
    : allCells.some(row => row.some(cell => !cell.Available)) ? 'decimal_projection_unavailable' : 'available'
  if (value.Code !== expected) throw invalidManagementOrders()
  return value
}
export function invalidManagementOrders() { return new Error('Сервер повернув непідтверджений результат замовлень або інший місяць.') }
