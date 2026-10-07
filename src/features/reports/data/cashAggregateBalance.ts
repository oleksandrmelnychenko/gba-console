import type { ReportCatalogueEntry } from '../types'
import { debtToSalesRatioCellText } from './debtToSalesRatio'

export const CASH_AGGREGATE_BALANCE_SOURCE = {
  World: 'fenix', SourceId: '0xb4b500055d78a52511ddfc0eb172d884',
  DefinitionSha256: '063ba31d7d426d728eb43b2dcf2d013aa3a0385602ff3dd025a81de0c94a5cb8',
} as const
export const CASH_AGGREGATE_BALANCE_TITLE = 'Совокупный остаток денежных средств'
export const CASH_AGGREGATE_BALANCE_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
type SourceIdentity = typeof CASH_AGGREGATE_BALANCE_SOURCE
type Column = typeof CASH_AGGREGATE_BALANCE_COLUMNS[number]
type Basis = { InputBasis: 'CurrentOurCashManagementClosing'; SourceParityVerified: false }
export type CashAggregateBalanceCapabilities = Basis & {
  Version: 1; SourceIdentity: SourceIdentity; Title: string; Executable: boolean
  Periodicity: 'Quarter'; PreviousPeriodOffset: -1; PeriodParameterType: 'Date'; Grouping: 'БанковскийСчетКасса'
  Columns: Column[]; Filters: []
}
export type CashAggregateBalanceRequest = { Version: 1; SourceIdentity: SourceIdentity; Period: string }
export type CashAggregateBalancePeriod = { Day: string; ThroughExclusive: string }
export type CashAggregateBalanceAccount = { Id: string; NetUid: string; Name: string }
export type CashAggregateBalanceCurrency = { Id: string; NetUid: string; Code: string; Name: string; SourceCurrencyRRef: string }
export type CashAggregateBalancePoint = {
  Code: string; PublicationId: string | null; ManagementClosing: string | null; ManagementCurrency: CashAggregateBalanceCurrency | null
  SourceGrain: { CashKindRRef: string; AccountTRef: string; AccountRRef: string; OrganizationRRef: string } | null
  CaptureStartedAtUtc: string | null; CaptureCompletedAtUtc: string | null; Day: string | null
}
export type CashAggregateBalanceLeg = {
  Native: { Account: CashAggregateBalanceAccount; CurrencyRegisterId: string; CurrencyRegisterNetUid: string
    CurrencyId: string; CurrencyNetUid: string; OrganizationId: string; OrganizationNetUid: string }
  Current: CashAggregateBalancePoint; Previous: CashAggregateBalancePoint
}
export type CashAggregateBalanceInput = {
  Available: boolean; Amount: string | null; Currency: CashAggregateBalanceCurrency | null
  IncludedLegs: number; KnownLegs: number; Code: string
}
export type CashAggregateBalanceInputs = { Current: CashAggregateBalanceInput; Previous: CashAggregateBalanceInput }
export type CashAggregateBalanceCell = { Key: Column['Key']; Value: string | null; Available: boolean }
export type CashAggregateBalanceTotals = { Cells: CashAggregateBalanceCell[]; Inputs: CashAggregateBalanceInputs; CalculationCode: string }
export type CashAggregateBalanceRow = CashAggregateBalanceTotals & { Account: CashAggregateBalanceAccount; Legs: CashAggregateBalanceLeg[] }
export type CashAggregateBalanceReport = Basis & {
  Version: 1; SourceIdentity: SourceIdentity; Period: string; Grouping: 'БанковскийСчетКасса'
  CurrentPeriod: CashAggregateBalancePeriod; PreviousPeriod: CashAggregateBalancePeriod; Columns: Column[]
  Rows: CashAggregateBalanceRow[]; Totals: CashAggregateBalanceTotals
  ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const identity = (value: unknown) => record(value) && Object.entries(CASH_AGGREGATE_BALANCE_SOURCE).every(([key, expected]) => value[key] === expected)
const columns = (value: unknown) => Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(CASH_AGGREGATE_BALANCE_COLUMNS[index]).every(([key, expected]) => column[key] === expected))
const decimal = (value: unknown): value is string => typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
const id = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value)
  && (value.length < 19 || value <= '9223372036854775807')
const guid = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
const utc = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value)
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const hex = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{32}$/i.test(value)
const basis = (value: Record<string, unknown>) => value.InputBasis === 'CurrentOurCashManagementClosing' && value.SourceParityVerified === false
const unavailablePointCodes = ['period_not_published', 'period_storage_unavailable', 'native_binding_unavailable',
  'publication_invalid', 'publication_range_unavailable', 'period_storage_date_unavailable']
const inputCodes = ['available', 'management_currency_unconfirmed', 'source_grain_ambiguous', 'mixed_management_currency', ...unavailablePointCodes]
const calculationCodes = ['available', 'management_currency_changed', 'percentage_range_unavailable', 'period_coverage_unavailable']

function days(year: number, month: number): number {
  return month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
    : [4, 6, 9, 11].includes(month) ? 30 : 31
}
function dayParts(value: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days(year, month) ? { year, month, day } : null
}
function dateText(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function previousQuarterDay(value: string): string {
  const parsed = dayParts(value)
  if (!parsed) throw new Error('Оберіть коректну дату залишків коштів.')
  const index = parsed.year * 12 + parsed.month - 1 - 3
  const year = Math.floor(index / 12), month = index % 12 + 1
  return dateText(year, month, Math.min(parsed.day, days(year, month)))
}
function nextDay(value: string): string {
  const { year, month, day } = dayParts(value)!
  return day < days(year, month) ? dateText(year, month, day + 1)
    : month < 12 ? dateText(year, month + 1, 1) : dateText(year + 1, 1, 1)
}
export function cashAggregateBalancePeriodError(period: string): string | null {
  const parsed = dayParts(period)
  return !parsed || parsed.year === 1 && parsed.month <= 3 || period === '9999-12-31'
    ? 'Оберіть дату з доступною датою порівняння за три місяці раніше.' : null
}
export function cashAggregateBalancePeriods(period: string) {
  const error = cashAggregateBalancePeriodError(period)
  if (error) throw new Error(error)
  const previous = previousQuarterDay(period)
  return { CurrentPeriod: { Day: period, ThroughExclusive: nextDay(period) },
    PreviousPeriod: { Day: previous, ThroughExclusive: nextDay(previous) } }
}
export const cashAggregateBalanceCellText = debtToSalesRatioCellText
export function isCashAggregateBalanceCatalogueEntry(report: ReportCatalogueEntry): boolean {
  return report.Id === `custom:fenix:${CASH_AGGREGATE_BALANCE_SOURCE.SourceId}`
    && report.Sources.filter(source => source.World === 'fenix' && source.SourceId === CASH_AGGREGATE_BALANCE_SOURCE.SourceId).length === 1
}
export function isCashAggregateBalanceCapabilities(value: unknown): value is CashAggregateBalanceCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && basis(value)
    && value.Title === CASH_AGGREGATE_BALANCE_TITLE && typeof value.Executable === 'boolean'
    && value.Periodicity === 'Quarter' && value.PreviousPeriodOffset === -1 && value.PeriodParameterType === 'Date'
    && value.Grouping === 'БанковскийСчетКасса' && columns(value.Columns) && Array.isArray(value.Filters) && value.Filters.length === 0
}
export function createCashAggregateBalanceRequest(capability: CashAggregateBalanceCapabilities, period: string): CashAggregateBalanceRequest {
  if (!isCashAggregateBalanceCapabilities(capability) || !capability.Executable)
    throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = cashAggregateBalancePeriodError(period)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...CASH_AGGREGATE_BALANCE_SOURCE }, Period: period }
}
const account = (value: unknown): value is CashAggregateBalanceAccount => record(value) && id(value.Id) && guid(value.NetUid) && typeof value.Name === 'string'
const currency = (value: unknown): value is CashAggregateBalanceCurrency => record(value) && id(value.Id) && guid(value.NetUid)
  && typeof value.Code === 'string' && /^\d{3}$/.test(value.Code) && typeof value.Name === 'string' && hex(value.SourceCurrencyRRef)
function input(value: unknown): value is CashAggregateBalanceInput {
  return record(value) && typeof value.Available === 'boolean' && count(value.IncludedLegs) && count(value.KnownLegs)
    && value.KnownLegs <= value.IncludedLegs && inputCodes.includes(String(value.Code)) && (value.Available
      ? decimal(value.Amount) && value.Code === 'available' && value.KnownLegs === value.IncludedLegs
        && (value.IncludedLegs === 0 ? value.Currency === null : currency(value.Currency))
      : value.Amount === null && value.Currency === null && value.Code !== 'available')
}
const inputs = (value: unknown): value is CashAggregateBalanceInputs => record(value) && input(value.Current) && input(value.Previous)
const cells = (value: unknown): value is CashAggregateBalanceCell[] => Array.isArray(value) && value.length === 4
  && value.every((cell, index) => record(cell) && cell.Key === CASH_AGGREGATE_BALANCE_COLUMNS[index].Key
    && typeof cell.Available === 'boolean' && (cell.Available ? decimal(cell.Value) : cell.Value === null))
const totals = (value: unknown): value is CashAggregateBalanceTotals => record(value) && cells(value.Cells) && inputs(value.Inputs)
  && calculationCodes.includes(String(value.CalculationCode))
function point(value: unknown, period: CashAggregateBalancePeriod): value is CashAggregateBalancePoint {
  if (!record(value) || typeof value.Code !== 'string') return false
  if (value.PublicationId === null) return unavailablePointCodes.includes(value.Code)
    && ['ManagementClosing', 'ManagementCurrency', 'SourceGrain', 'CaptureStartedAtUtc', 'CaptureCompletedAtUtc', 'Day'].every(key => value[key] === null)
  return guid(value.PublicationId) && decimal(value.ManagementClosing) && value.Day === period.Day
    && record(value.SourceGrain) && hex(value.SourceGrain.CashKindRRef) && hex(value.SourceGrain.AccountRRef)
    && hex(value.SourceGrain.OrganizationRRef) && ['0000000F', '00000038'].includes(String(value.SourceGrain.AccountTRef))
    && utc(value.CaptureStartedAtUtc) && utc(value.CaptureCompletedAtUtc)
    && (value.Code === 'available' ? currency(value.ManagementCurrency)
      : value.Code === 'management_currency_unconfirmed' && value.ManagementCurrency === null)
}
function leg(value: unknown, row: CashAggregateBalanceAccount, periods: ReturnType<typeof cashAggregateBalancePeriods>): value is CashAggregateBalanceLeg {
  if (!record(value) || !record(value.Native)) return false
  const native = value.Native, bound = native.Account
  return account(bound) && bound.Id === row.Id && bound.NetUid.toLowerCase() === row.NetUid.toLowerCase() && bound.Name === row.Name
    && id(native.CurrencyRegisterId) && guid(native.CurrencyRegisterNetUid)
    && (native.CurrencyId === '0' || id(native.CurrencyId)) && guid(native.CurrencyNetUid)
    && (native.OrganizationId === '0' || id(native.OrganizationId)) && guid(native.OrganizationNetUid)
    && point(value.Current, periods.CurrentPeriod) && point(value.Previous, periods.PreviousPeriod)
}
function row(value: unknown, periods: ReturnType<typeof cashAggregateBalancePeriods>): value is CashAggregateBalanceRow {
  if (!record(value) || !account(value.Account)) return false
  const bound = value.Account
  return Array.isArray(value.Legs) && value.Legs.every(item => leg(item, bound, periods)) && totals(value)
}
/** Render server account groups and recomputed totals, preserving each independent point clock and every NULL. */
export function normalizeCashAggregateBalanceReport(value: unknown, request: CashAggregateBalanceRequest): CashAggregateBalanceReport {
  const periods = cashAggregateBalancePeriods(request.Period)
  if (!record(value) || value.Version !== 1 || !identity(value.SourceIdentity) || !basis(value) || value.Period !== request.Period
    || value.Grouping !== 'БанковскийСчетКасса' || !columns(value.Columns) || !record(value.CurrentPeriod) || !record(value.PreviousPeriod)
    || value.CurrentPeriod.Day !== periods.CurrentPeriod.Day || value.CurrentPeriod.ThroughExclusive !== periods.CurrentPeriod.ThroughExclusive
    || value.PreviousPeriod.Day !== periods.PreviousPeriod.Day || value.PreviousPeriod.ThroughExclusive !== periods.PreviousPeriod.ThroughExclusive
    || !Array.isArray(value.Rows) || !value.Rows.every(item => row(item, periods))
    || new Set(value.Rows.map(row => `${row.Account.Id}:${row.Account.NetUid.toLowerCase()}`)).size !== value.Rows.length
    || !totals(value.Totals) || !utc(value.ObservationStartedAtUtc) || !utc(value.ObservationCompletedAtUtc)
    || typeof value.RequestSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.RequestSha256)
    || typeof value.ResultSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.ResultSha256)
    || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string')
    throw new Error('Сервер повернув некоректний результат залишків, дату або групування рахунків.')
  return value as unknown as CashAggregateBalanceReport
}
