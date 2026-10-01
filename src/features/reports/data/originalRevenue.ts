import type { ReportCatalogueEntry } from '../types'
import { debtToSalesRatioCellText, debtToSalesRatioMonthError, debtToSalesRatioPeriods } from './debtToSalesRatio'

export const ORIGINAL_REVENUE_SOURCE = {
  World: 'fenix', SourceId: '0xb4b500055d78a52511ddfc172c5097fe',
  DefinitionSha256: 'd3b10aeb75af21b202be4fae4004691c4c0bee0dbe3325e1dfa505a802392838',
} as const
export const ORIGINAL_REVENUE_TITLE = 'Выручка'
export const ORIGINAL_REVENUE_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
type SourceIdentity = typeof ORIGINAL_REVENUE_SOURCE
type Column = typeof ORIGINAL_REVENUE_COLUMNS[number]
type Basis = { InputBasis: 'CurrentOurRecordedGrossEur'; IdentityBasis: 'CurrentOurClient'; Currency: 'EUR'
  IncludesPostedSaleAndReturnLines: true; SourceParityVerified: false }
export type OriginalRevenueCapabilities = Basis & {
  Version: 1; SourceIdentity: SourceIdentity; Title: string; Executable: boolean
  Periodicity: 'Month'; PreviousMonthOffset: -1; RowCaption: 'Контрагент'; Columns: Column[]; Filters: []
}
export type OriginalRevenueRequest = { Version: 1; SourceIdentity: SourceIdentity; Month: string }
export type OriginalRevenueInput = { SaleLines: number; ReturnLines: number; UnknownMoneyLines: number; GrossEur: string | null }
export type OriginalRevenueCell = { Key: Column['Key']; Value: string | null; Available: boolean }
export type OriginalRevenueTotals = { Current: OriginalRevenueInput; Previous: OriginalRevenueInput; Cells: OriginalRevenueCell[] }
export type OriginalRevenueRow = OriginalRevenueTotals & { ClientId: string | null; Caption: string; Attributed: boolean }
export type OriginalRevenueReport = Basis & {
  Version: 1; SourceIdentity: SourceIdentity; Month: string; RowCaption: 'Контрагент'; Columns: Column[]
  CurrentPeriod: { From: string; ThroughExclusive: string }; PreviousPeriod: { From: string; ThroughExclusive: string }
  Rows: OriginalRevenueRow[]; Totals: OriginalRevenueTotals
  ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const identity = (value: unknown) => record(value) && Object.entries(ORIGINAL_REVENUE_SOURCE).every(([key, expected]) => value[key] === expected)
const columns = (value: unknown) => Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(ORIGINAL_REVENUE_COLUMNS[index]).every(([key, expected]) => column[key] === expected))
const decimal = (value: unknown, scale: number): value is string => typeof value === 'string'
  && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && (value.split('.')[1]?.length ?? 0) <= scale
const id = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value)
  && (value.length < 19 || value <= '9223372036854775807')
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const utc = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value)
const basis = (value: Record<string, unknown>) => value.InputBasis === 'CurrentOurRecordedGrossEur'
  && value.IdentityBasis === 'CurrentOurClient' && value.Currency === 'EUR'
  && value.IncludesPostedSaleAndReturnLines === true && value.SourceParityVerified === false
export function originalRevenueMonthError(month: string): string | null {
  return debtToSalesRatioMonthError(month) ?? (month === '0001-02' ? 'Оберіть місяць з доступним попереднім періодом.' : null)
}
export function originalRevenuePeriods(month: string) {
  const error = originalRevenueMonthError(month)
  if (error) throw new Error(error)
  return debtToSalesRatioPeriods(month)
}
export const originalRevenueCellText = debtToSalesRatioCellText
export function isOriginalRevenueCatalogueEntry(report: ReportCatalogueEntry): boolean {
  return report.Id === `custom:fenix:${ORIGINAL_REVENUE_SOURCE.SourceId}`
    && report.Sources.filter(source => source.World === 'fenix' && source.SourceId === ORIGINAL_REVENUE_SOURCE.SourceId).length === 1
}
export function isOriginalRevenueCapabilities(value: unknown): value is OriginalRevenueCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && basis(value)
    && value.Title === ORIGINAL_REVENUE_TITLE && typeof value.Executable === 'boolean' && value.Periodicity === 'Month'
    && value.PreviousMonthOffset === -1 && value.RowCaption === 'Контрагент' && columns(value.Columns)
    && Array.isArray(value.Filters) && value.Filters.length === 0
}
export function createOriginalRevenueRequest(capability: OriginalRevenueCapabilities, month: string): OriginalRevenueRequest {
  if (!isOriginalRevenueCapabilities(capability) || !capability.Executable) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = originalRevenueMonthError(month)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...ORIGINAL_REVENUE_SOURCE }, Month: month }
}
function input(value: unknown): value is OriginalRevenueInput {
  if (!record(value) || !count(value.SaleLines) || !count(value.ReturnLines) || !count(value.UnknownMoneyLines)) return false
  const lines = value.SaleLines + value.ReturnLines
  return Number.isSafeInteger(lines) && value.UnknownMoneyLines <= lines && (value.UnknownMoneyLines > 0
    ? value.GrossEur === null : decimal(value.GrossEur, 22) && (lines > 0 || value.GrossEur === '0'))
}
function totals(value: unknown): value is OriginalRevenueTotals {
  if (!record(value) || !input(value.Current) || !input(value.Previous) || !Array.isArray(value.Cells) || value.Cells.length !== 4) return false
  const cells: unknown[] = value.Cells
  if (!cells.every((cell, index) => record(cell) && cell.Key === ORIGINAL_REVENUE_COLUMNS[index].Key
    && typeof cell.Available === 'boolean' && (cell.Available ? decimal(cell.Value, 28) : cell.Value === null))) return false
  const bound = cells as OriginalRevenueCell[]
  return bound[0].Value === value.Current.GrossEur && bound[1].Value === value.Previous.GrossEur
    && (value.Previous.GrossEur === '0' ? bound[2].Value === '100'
      : bound[2].Available === (value.Current.GrossEur !== null && value.Previous.GrossEur !== null))
    && bound[3].Available === (value.Current.GrossEur !== null && value.Previous.GrossEur !== null)
}
function row(value: unknown): value is OriginalRevenueRow {
  return record(value) && totals(value) && typeof value.Caption === 'string' && value.Caption.trim().length > 0
    && (value.ClientId === null ? value.Attributed === false && value.Caption === 'Контрагент не определён'
      : id(value.ClientId) && value.Attributed === true)
    && value.Current.SaleLines + value.Current.ReturnLines + value.Previous.SaleLines + value.Previous.ReturnLines > 0
}
/** Preserve the server's exact EUR sums, unavailable cells and independent unattributed bucket; no client-side financial calculation. */
export function normalizeOriginalRevenueReport(value: unknown, request: OriginalRevenueRequest): OriginalRevenueReport {
  const periods = originalRevenuePeriods(request.Month)
  if (!record(value) || value.Version !== 1 || !identity(value.SourceIdentity) || !basis(value) || value.Month !== request.Month
    || value.RowCaption !== 'Контрагент' || !columns(value.Columns) || !record(value.CurrentPeriod) || !record(value.PreviousPeriod)
    || value.CurrentPeriod.From !== periods.CurrentPeriod.From || value.CurrentPeriod.ThroughExclusive !== periods.CurrentPeriod.ThroughExclusive
    || value.PreviousPeriod.From !== periods.PreviousPeriod.From || value.PreviousPeriod.ThroughExclusive !== periods.PreviousPeriod.ThroughExclusive
    || !Array.isArray(value.Rows) || !value.Rows.every(row) || new Set(value.Rows.map(item => item.ClientId)).size !== value.Rows.length
    || !totals(value.Totals) || !utc(value.ObservationStartedAtUtc) || !utc(value.ObservationCompletedAtUtc)
    || typeof value.RequestSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.RequestSha256)
    || typeof value.ResultSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.ResultSha256)
    || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string')
    throw new Error('Сервер повернув некоректний результат виручки, місяць або групування контрагентів.')
  return value as unknown as OriginalRevenueReport
}
