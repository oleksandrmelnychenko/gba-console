import type { ReportCatalogueEntry } from '../types'
import { debtToSalesRatioCellText } from './debtToSalesRatio'
import { originalRevenueMonthError, originalRevenuePeriods } from './originalRevenue'

export const ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS = {
  new: { SourceIdentity: { World: 'fenix', SourceId: '0xa6b50007e90a504c11de0990eefaedb3',
    DefinitionSha256: 'ddf4d3a95d4b6bf4fd7f9b8d0b48b95c7bfa91d88c95636c7b984f377b63b4ef' },
    Title: 'Доля продаж новым клиентам, %', Route: '/report/constructors/sales-new-buyer-share' },
  repeat: { SourceIdentity: { World: 'fenix', SourceId: '0xa6b50007e90a504c11de0990eefaedb5',
    DefinitionSha256: '3e7596294c82b9c6c4999ec473ba9ecbb22ecce7063c4510e891b57c2138f832' },
    Title: 'Доля повторных продаж, %', Route: '/report/constructors/sales-repeat-buyer-share' },
} as const
export const ORIGINAL_BUYER_SALES_SHARE_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Предыдущее значение', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
export type OriginalBuyerSalesShareVariant = keyof typeof ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS
export type OriginalBuyerSalesShareSourceIdentity = typeof ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[OriginalBuyerSalesShareVariant]['SourceIdentity']
type Column = typeof ORIGINAL_BUYER_SALES_SHARE_COLUMNS[number]
type Basis = { InputBasis: 'CurrentOurRecordedNetEur'; IdentityBasis: 'CurrentOurClient'
  HistoryBasis: 'AllPriorCurrentOurSaleAndReturnActivity'; Currency: 'EUR'; IncludesPostedSaleAndReturnLines: true
  BaseFractionIsPercent: false; SourceParityVerified: false; RawFractionalPlaces: 28 }
export type OriginalBuyerSalesShareCapabilities = Basis & { Version: 1; SourceIdentity: OriginalBuyerSalesShareSourceIdentity
  Title: string; Executable: boolean; Periodicity: 'Month'; PreviousMonthOffset: -1; Columns: Column[]; Filters: [] }
export type OriginalBuyerSalesShareRequest = { Version: 1; SourceIdentity: OriginalBuyerSalesShareSourceIdentity; Month: string }
export type OriginalBuyerSalesShareInput = { SaleLines: number; ReturnLines: number; UnknownMoneyLines: number
  UnknownClientLines: number; UnknownHistoryLines: number; DenominatorNetEur: string | null; NumeratorNetEur: string | null
  RawFraction: string | null; FractionIsZero: boolean | null; Available: boolean; Code: 'available' | 'current_our_input_unavailable' }
export type OriginalBuyerSalesShareCell = { Key: Column['Key']; Value: string | null; Available: boolean }
export type OriginalBuyerSalesShareReport = Basis & { Version: 1; SourceIdentity: OriginalBuyerSalesShareSourceIdentity; Title: string; Month: string
  CurrentPeriod: { From: string; ThroughExclusive: string }; PreviousPeriod: { From: string; ThroughExclusive: string }
  Columns: Column[]; Cells: OriginalBuyerSalesShareCell[]; TotalCells: OriginalBuyerSalesShareCell[]
  Inputs: { Current: OriginalBuyerSalesShareInput; Previous: OriginalBuyerSalesShareInput }
  ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string; RequestSha256: string; ResultSha256: string
  DocumentURL: string; PdfDocumentURL: string }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const decimal = (value: unknown): value is string => typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
  && (value.split('.')[1]?.length ?? 0) <= 28
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const utc = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value)
const columns = (value: unknown) => Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(ORIGINAL_BUYER_SALES_SHARE_COLUMNS[index]).every(([key, expected]) => column[key] === expected))
const basis = (value: Record<string, unknown>) => value.InputBasis === 'CurrentOurRecordedNetEur'
  && value.IdentityBasis === 'CurrentOurClient' && value.HistoryBasis === 'AllPriorCurrentOurSaleAndReturnActivity'
  && value.Currency === 'EUR' && value.IncludesPostedSaleAndReturnLines === true
  && value.BaseFractionIsPercent === false && value.SourceParityVerified === false && value.RawFractionalPlaces === 28
export function originalBuyerSalesShareVariant(source: unknown): OriginalBuyerSalesShareVariant | null {
  if (!record(source)) return null
  return (Object.keys(ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS) as OriginalBuyerSalesShareVariant[]).find(variant =>
    Object.entries(ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[variant].SourceIdentity).every(([key, expected]) => source[key] === expected)) ?? null
}
/** Original launches use their exact catalogue identities, independently of native17 capabilities or migration status. */
export function originalBuyerSalesShareCatalogueVariant(report: ReportCatalogueEntry): OriginalBuyerSalesShareVariant | null {
  return (Object.keys(ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS) as OriginalBuyerSalesShareVariant[]).find(variant => {
    const source = ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[variant].SourceIdentity
    return report.Id === `custom:fenix:${source.SourceId}`
      && report.Sources.filter(item => item.World === source.World && item.SourceId === source.SourceId).length === 1
  }) ?? null
}
export function isOriginalBuyerSalesShareCapabilities(value: unknown, expectedVariant?: OriginalBuyerSalesShareVariant): value is OriginalBuyerSalesShareCapabilities {
  if (!record(value)) return false
  const variant = originalBuyerSalesShareVariant(value.SourceIdentity)
  return variant !== null && (expectedVariant === undefined || variant === expectedVariant) && value.Version === 1
    && value.Title === ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[variant].Title && basis(value) && typeof value.Executable === 'boolean'
    && value.Periodicity === 'Month' && value.PreviousMonthOffset === -1 && columns(value.Columns)
    && Array.isArray(value.Filters) && value.Filters.length === 0
}
export const originalBuyerSalesShareMonthError = originalRevenueMonthError
export const originalBuyerSalesSharePeriods = originalRevenuePeriods
export const originalBuyerSalesShareCellText = debtToSalesRatioCellText
export function createOriginalBuyerSalesShareRequest(capability: OriginalBuyerSalesShareCapabilities, month: string): OriginalBuyerSalesShareRequest {
  if (!isOriginalBuyerSalesShareCapabilities(capability) || !capability.Executable) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = originalBuyerSalesShareMonthError(month)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...capability.SourceIdentity }, Month: month }
}
function input(value: unknown): value is OriginalBuyerSalesShareInput {
  if (!record(value) || !count(value.SaleLines) || !count(value.ReturnLines) || !count(value.UnknownMoneyLines)
    || !count(value.UnknownClientLines) || !count(value.UnknownHistoryLines) || typeof value.Available !== 'boolean') return false
  const lines = value.SaleLines + value.ReturnLines
  if (!Number.isSafeInteger(lines) || [value.UnknownMoneyLines, value.UnknownClientLines, value.UnknownHistoryLines].some(n => n > lines)) return false
  const denominatorKnown = value.UnknownMoneyLines === 0 && value.UnknownClientLines === 0
  const numeratorKnown = denominatorKnown && value.UnknownHistoryLines === 0
  return (denominatorKnown ? decimal(value.DenominatorNetEur) : value.DenominatorNetEur === null)
    && (numeratorKnown ? decimal(value.NumeratorNetEur) : value.NumeratorNetEur === null)
    && (value.Available ? decimal(value.RawFraction) && typeof value.FractionIsZero === 'boolean' && value.Code === 'available'
      : value.RawFraction === null && value.FractionIsZero === null && value.Code === 'current_our_input_unavailable')
}
function cells(value: unknown): value is OriginalBuyerSalesShareCell[] {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => record(cell)
    && cell.Key === ORIGINAL_BUYER_SALES_SHARE_COLUMNS[index].Key && typeof cell.Available === 'boolean'
    && (cell.Available ? decimal(cell.Value) : cell.Value === null))
}
/** Preserve scalar fractions, independent source grand totals, raw precision and NULL; do no financial arithmetic in the Console. */
export function normalizeOriginalBuyerSalesShareReport(value: unknown, request: OriginalBuyerSalesShareRequest): OriginalBuyerSalesShareReport {
  const periods = originalBuyerSalesSharePeriods(request.Month), variant = originalBuyerSalesShareVariant(request.SourceIdentity)
  if (!record(value) || variant === null || value.Version !== 1 || originalBuyerSalesShareVariant(value.SourceIdentity) !== variant
    || value.Title !== ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[variant].Title || !basis(value) || value.Month !== request.Month
    || !columns(value.Columns) || !record(value.CurrentPeriod) || !record(value.PreviousPeriod)
    || value.CurrentPeriod.From !== periods.CurrentPeriod.From || value.CurrentPeriod.ThroughExclusive !== periods.CurrentPeriod.ThroughExclusive
    || value.PreviousPeriod.From !== periods.PreviousPeriod.From || value.PreviousPeriod.ThroughExclusive !== periods.PreviousPeriod.ThroughExclusive
    || !cells(value.Cells) || !cells(value.TotalCells) || !record(value.Inputs) || !input(value.Inputs.Current) || !input(value.Inputs.Previous)
    || value.Cells[0].Value !== value.Inputs.Current.RawFraction || value.Cells[1].Value !== value.Inputs.Previous.RawFraction
    || (value.Inputs.Previous.FractionIsZero === true ? value.Cells[2].Value !== '100'
      : value.Cells[2].Available !== (value.Inputs.Current.Available && value.Inputs.Previous.Available))
    || value.Cells[3].Available !== (value.Inputs.Current.Available && value.Inputs.Previous.Available)
    || !utc(value.ObservationStartedAtUtc) || !utc(value.ObservationCompletedAtUtc)
    || typeof value.RequestSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.RequestSha256)
    || typeof value.ResultSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.ResultSha256)
    || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string')
    throw new Error('Сервер повернув некоректний результат частки продажів або інший місячний період.')
  return value as unknown as OriginalBuyerSalesShareReport
}
