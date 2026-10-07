import type { ReportCatalogueEntry } from '../types'
import { debtToSalesRatioCellText, debtToSalesRatioMonthError, debtToSalesRatioPeriods } from './debtToSalesRatio'

export const CURRENCY_RATE_DYNAMICS_SOURCE = {
  World: 'fenix', SourceId: '0xb4b500055d78a52511ddfdbede3b0526',
  DefinitionSha256: '25e754806ce574b1b429dc9e63382182c63c208ac38681687d55b3f8ebceda68',
} as const
export const CURRENCY_RATE_DYNAMICS_TITLE = 'Динамика курса базовой валюты'
export const CURRENCY_RATE_DYNAMICS_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
type SourceIdentity = typeof CURRENCY_RATE_DYNAMICS_SOURCE
type Column = typeof CURRENCY_RATE_DYNAMICS_COLUMNS[number]
type Basis = { InputBasis: 'CurrentOurRateHistory'; DateSemantics: 'stored-calendar-month-end'; SourceParityVerified: false }
export type CurrencyRateDynamicsCapabilities = Basis & {
  Version: 1; SourceIdentity: SourceIdentity; Title: string; Executable: boolean
  Periodicity: 'Month'; PreviousMonthOffset: -1; Columns: Column[]; Filters: []
  Parameters: [{ Key: 'RateDefinitionId'; Caption: 'Валюта'; IdentityBasis: 'CurrentOurOrderedPair' }]
  RateKind: 'commercial'
}
export type CurrencyRateDynamicsDefinition = {
  RateDefinitionId: string; RateKind: 'commercial'; BaseCurrencyId: string; BaseCode: string; BaseName: string
  TargetCurrencyId: string; TargetCode: string; TargetName: string
}
export type CurrencyRateDynamicsRequest = { Version: 1; SourceIdentity: SourceIdentity; Month: string; RateDefinitionId: string }
export type CurrencyRateDynamicsInput = {
  Available: boolean; HistoryId: string | null; Created: string | null; Amount: string | null
  Code: 'available' | 'history_missing' | 'latest_point_ambiguous'
}
export type CurrencyRateDynamicsReport = Basis & {
  Version: 1; SourceIdentity: SourceIdentity; Month: string
  CurrentPeriod: { From: string; ThroughExclusive: string }; PreviousPeriod: { From: string; ThroughExclusive: string }
  RateDefinition: CurrencyRateDynamicsDefinition; Columns: Column[]
  Cells: Array<{ Key: Column['Key']; Value: string | null; Available: boolean }>
  Inputs: { Current: CurrencyRateDynamicsInput; Previous: CurrencyRateDynamicsInput }
  CalculationCode: 'available' | 'rate_history_unavailable' | 'percentage_range_unavailable'
  ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const identity = (value: unknown) => record(value) && Object.entries(CURRENCY_RATE_DYNAMICS_SOURCE).every(([key, expected]) => value[key] === expected)
const columns = (value: unknown) => Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(CURRENCY_RATE_DYNAMICS_COLUMNS[index]).every(([key, expected]) => column[key] === expected))
const decimal = (value: unknown): value is string => typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
const id = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value)
  && (value.length < 19 || value <= '9223372036854775807')
const text = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.length > 0
  && value.length <= maximum && value === value.trim() && !Array.from(value).some(char => {
    const code = char.charCodeAt(0); return code < 32 || code >= 127 && code <= 159
  })
const basis = (value: Record<string, unknown>) => value.InputBasis === 'CurrentOurRateHistory'
  && value.DateSemantics === 'stored-calendar-month-end' && value.SourceParityVerified === false
const utc = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value)
const storedDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?$/.test(value)

export function isCurrencyRateDynamicsCatalogueEntry(report: ReportCatalogueEntry): boolean {
  return report.Id === `custom:fenix:${CURRENCY_RATE_DYNAMICS_SOURCE.SourceId}`
    && report.Sources.filter(source => source.World === 'fenix' && source.SourceId === CURRENCY_RATE_DYNAMICS_SOURCE.SourceId).length === 1
}
export function isCurrencyRateDynamicsCapabilities(value: unknown): value is CurrencyRateDynamicsCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && basis(value)
    && value.Title === CURRENCY_RATE_DYNAMICS_TITLE && typeof value.Executable === 'boolean'
    && value.Periodicity === 'Month' && value.PreviousMonthOffset === -1 && value.RateKind === 'commercial'
    && columns(value.Columns) && Array.isArray(value.Filters) && value.Filters.length === 0
    && Array.isArray(value.Parameters) && value.Parameters.length === 1 && record(value.Parameters[0])
    && value.Parameters[0].Key === 'RateDefinitionId' && value.Parameters[0].Caption === 'Валюта'
    && value.Parameters[0].IdentityBasis === 'CurrentOurOrderedPair'
}
export function isCurrencyRateDynamicsDefinition(value: unknown): value is CurrencyRateDynamicsDefinition {
  return record(value) && id(value.RateDefinitionId) && value.RateKind === 'commercial'
    && id(value.BaseCurrencyId) && id(value.TargetCurrencyId) && value.BaseCurrencyId !== value.TargetCurrencyId
    && text(value.BaseCode, 32) && text(value.TargetCode, 32) && value.BaseCode !== value.TargetCode
    && text(value.BaseName, 512) && text(value.TargetName, 512)
}
export function normalizeCurrencyRateDynamicsDefinitions(value: unknown): CurrencyRateDynamicsDefinition[] {
  if (!Array.isArray(value) || !value.every(isCurrencyRateDynamicsDefinition)
    || new Set(value.map(row => row.RateDefinitionId)).size !== value.length)
    throw new Error('Сервер повернув некоректні валютні пари.')
  return value
}
export function currencyRateDynamicsDefinitionLabel(definition: CurrencyRateDynamicsDefinition): string {
  return `${definition.BaseCode} (${definition.BaseName}) → ${definition.TargetCode} (${definition.TargetName}) · ${definition.RateDefinitionId}`
}
export const currencyRateDynamicsMonthError = debtToSalesRatioMonthError
export const currencyRateDynamicsPeriods = debtToSalesRatioPeriods
export const currencyRateDynamicsCellText = debtToSalesRatioCellText
export function defaultCurrencyRateDynamicsMonth(today: string): string {
  return currencyRateDynamicsPeriods(today.slice(0, 7)).PreviousPeriod.From.slice(0, 7)
}
export function createCurrencyRateDynamicsRequest(capability: CurrencyRateDynamicsCapabilities, month: string,
  definition: CurrencyRateDynamicsDefinition): CurrencyRateDynamicsRequest {
  if (!isCurrencyRateDynamicsCapabilities(capability) || !capability.Executable)
    throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = currencyRateDynamicsMonthError(month)
  if (error) throw new Error(error)
  if (!isCurrencyRateDynamicsDefinition(definition)) throw new Error('Оберіть точну валютну пару з поточного списку.')
  return { Version: 1, SourceIdentity: { ...CURRENCY_RATE_DYNAMICS_SOURCE }, Month: month, RateDefinitionId: definition.RateDefinitionId }
}
function input(value: unknown): value is CurrencyRateDynamicsInput {
  return record(value) && typeof value.Available === 'boolean' && (value.Available
    ? id(value.HistoryId) && storedDate(value.Created) && decimal(value.Amount) && value.Code === 'available'
    : value.HistoryId === null && value.Created === null && value.Amount === null
      && (value.Code === 'history_missing' || value.Code === 'latest_point_ambiguous'))
}
/** Preserve exact OUR decimal strings and unknown cells; all calculations and exports come from one server result. */
export function normalizeCurrencyRateDynamicsReport(value: unknown, request: CurrencyRateDynamicsRequest,
  selected: CurrencyRateDynamicsDefinition): CurrencyRateDynamicsReport {
  const periods = currencyRateDynamicsPeriods(request.Month)
  if (!record(value) || value.Version !== 1 || !identity(value.SourceIdentity) || !basis(value) || value.Month !== request.Month
    || !isCurrencyRateDynamicsDefinition(value.RateDefinition) || value.RateDefinition.RateDefinitionId !== request.RateDefinitionId
    || value.RateDefinition.BaseCurrencyId !== selected.BaseCurrencyId || value.RateDefinition.TargetCurrencyId !== selected.TargetCurrencyId
    || !columns(value.Columns) || !record(value.CurrentPeriod) || !record(value.PreviousPeriod)
    || value.CurrentPeriod.From !== periods.CurrentPeriod.From || value.CurrentPeriod.ThroughExclusive !== periods.CurrentPeriod.ThroughExclusive
    || value.PreviousPeriod.From !== periods.PreviousPeriod.From || value.PreviousPeriod.ThroughExclusive !== periods.PreviousPeriod.ThroughExclusive
    || !Array.isArray(value.Cells) || value.Cells.length !== 4 || !value.Cells.every((cell, index) => record(cell)
      && cell.Key === CURRENCY_RATE_DYNAMICS_COLUMNS[index].Key && typeof cell.Available === 'boolean'
      && (cell.Available ? decimal(cell.Value) : cell.Value === null))
    || !record(value.Inputs) || !input(value.Inputs.Current) || !input(value.Inputs.Previous)
    || !['available', 'rate_history_unavailable', 'percentage_range_unavailable'].includes(String(value.CalculationCode))
    || !utc(value.ObservationStartedAtUtc) || !utc(value.ObservationCompletedAtUtc)
    || typeof value.RequestSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.RequestSha256)
    || typeof value.ResultSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.ResultSha256)
    || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string')
    throw new Error('Сервер повернув некоректний результат, іншу валютну пару або місячний період.')
  return value as unknown as CurrencyRateDynamicsReport
}
