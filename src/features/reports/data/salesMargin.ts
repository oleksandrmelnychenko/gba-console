import type { ReportCatalogueEntry } from '../types'

export const SALES_MARGIN_SOURCE = {
  World: 'fenix',
  SourceId: '0xa6b50007e90a504c11de0962351b1edd',
  DefinitionSha256: '4499353c7efeeb0562fcd6fc3027bbc4f6ea91ae1b33e215f6d1194ae77b83e3',
} as const
export const SALES_MARGIN_TITLE = 'Маржа %'
export const SALES_MARGIN_INPUT_BASIS = 'CurrentOurMonthlyNetSalesAndRetainedNetCostEur'
export const SALES_MARGIN_PRESENTATION_BASIS = 'CurrentGbaClrDecimal'
export const SALES_MARGIN_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: 2 },
] as const

export type SalesMarginCapabilities = {
  Version: 1
  SourceIdentity: typeof SALES_MARGIN_SOURCE
  Title: typeof SALES_MARGIN_TITLE
  Executable: boolean
  Periodicity: 'Month'
  PreviousMonthOffset: -1
  Columns: Array<typeof SALES_MARGIN_COLUMNS[number]>
  Filters: []
  InputBasis: typeof SALES_MARGIN_INPUT_BASIS
  PresentationBasis: typeof SALES_MARGIN_PRESENTATION_BASIS
  Currency: 'EUR'
  IncludesPostedSaleAndReturnLines: true
  EffectiveSourcePeriodsVerified: false
  SourceParityVerified: false
  MaximumFacts: 200000
}
export type SalesMarginRequest = { Version: 1; SourceIdentity: typeof SALES_MARGIN_SOURCE; Month: string }
type ExactNumber = { Numerator: string; Denominator: string }
export type SalesMarginInput = {
  SaleLines: number
  ReturnLines: number
  UnknownSalesLines: number
  CostGroups: number
  UnknownCostGroups: number
  SalesEur: ExactNumber | null
  CostEur: ExactNumber | null
  Available: boolean
}
export type SalesMarginReport = {
  Version: 1
  SourceIdentity: typeof SALES_MARGIN_SOURCE
  Month: string
  CurrentPeriod: { From: string; ThroughExclusive: string }
  PreviousPeriod: { From: string; ThroughExclusive: string }
  Columns: Array<typeof SALES_MARGIN_COLUMNS[number]>
  Cells: Array<{ Key: typeof SALES_MARGIN_COLUMNS[number]['Key']; Value: string | null; Available: boolean; FormattedValue: string | null }>
  Inputs: { Current: SalesMarginInput; Previous: SalesMarginInput }
  Complete: boolean
  HasRows: boolean
  Code: 'available' | 'recorded_empty' | 'input_not_available' | 'arithmetic_or_projection_unavailable'
  InputBasis: typeof SALES_MARGIN_INPUT_BASIS
  PresentationBasis: typeof SALES_MARGIN_PRESENTATION_BASIS
  Currency: 'EUR'
  EffectiveSourcePeriodsVerified: false
  SourceParityVerified: false
  ObservationStartedAtUtc: string
  ObservationCompletedAtUtc: string
  RequestSha256: string
  ResultSha256: string
  DocumentURL: string
  PdfDocumentURL: string
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 200000
const hash = (value: unknown) => typeof value === 'string' && /^[\da-f]{64}$/i.test(value)
const identity = (value: unknown) => record(value) && Object.entries(SALES_MARGIN_SOURCE).every(([key, expected]) => value[key] === expected)
const columns = (value: unknown) => Array.isArray(value) && value.length === 4
  && value.every((column, index) => record(column) && Object.entries(SALES_MARGIN_COLUMNS[index]).every(([key, expected]) => column[key] === expected))
const basis = (value: Record<string, unknown>) => value.InputBasis === SALES_MARGIN_INPUT_BASIS
  && value.PresentationBasis === SALES_MARGIN_PRESENTATION_BASIS && value.Currency === 'EUR'
  && value.EffectiveSourcePeriodsVerified === false && value.SourceParityVerified === false

export function isSalesMarginCatalogueEntry(report: ReportCatalogueEntry): boolean {
  const sources = report.Sources.filter(source => source.World === SALES_MARGIN_SOURCE.World && source.SourceId === SALES_MARGIN_SOURCE.SourceId)
  return report.Id === `custom:fenix:${SALES_MARGIN_SOURCE.SourceId}`
    && sources.length === 1 && (sources[0].DefinitionSha256 === null || sources[0].DefinitionSha256 === SALES_MARGIN_SOURCE.DefinitionSha256)
}
export function isSalesMarginCapabilities(value: unknown): value is SalesMarginCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && value.Title === SALES_MARGIN_TITLE
    && typeof value.Executable === 'boolean' && value.Periodicity === 'Month' && value.PreviousMonthOffset === -1
    && columns(value.Columns) && Array.isArray(value.Filters) && value.Filters.length === 0 && basis(value)
    && value.IncludesPostedSaleAndReturnLines === true && value.MaximumFacts === 200000
}

export function salesMarginMonthError(month: string): string | null {
  return !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month <= '0001-02' || month >= '9999-12'
    ? 'Оберіть місяць із доступними поточним і попереднім періодами.' : null
}
export function salesMarginPeriods(month: string): Pick<SalesMarginReport, 'CurrentPeriod' | 'PreviousPeriod'> {
  if (salesMarginMonthError(month)) throw new Error('Некоректний місячний період звіту.')
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5))
  const shifted = (offset: number) => {
    const index = year * 12 + number - 1 + offset
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01`
  }
  return { CurrentPeriod: { From: shifted(0), ThroughExclusive: shifted(1) }, PreviousPeriod: { From: shifted(-1), ThroughExclusive: shifted(0) } }
}
export function createSalesMarginRequest(capability: SalesMarginCapabilities, month: string): SalesMarginRequest {
  if (!isSalesMarginCapabilities(capability) || !capability.Executable) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = salesMarginMonthError(month)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...SALES_MARGIN_SOURCE }, Month: month }
}

function exactNumber(value: unknown): value is ExactNumber {
  return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
    && value.Numerator.length <= 20000 && value.Denominator.length <= 20000
    && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator) && /^[1-9]\d*$/.test(value.Denominator)
    && (value.Numerator !== '0' || value.Denominator === '1')
}
function input(value: unknown): value is SalesMarginInput {
  if (!record(value) || typeof value.Available !== 'boolean'
    || ![value.SaleLines, value.ReturnLines, value.UnknownSalesLines, value.CostGroups, value.UnknownCostGroups].every(count)) return false
  const lines = (value.SaleLines as number) + (value.ReturnLines as number)
  const unknownSales = value.UnknownSalesLines as number, groups = value.CostGroups as number, unknownCost = value.UnknownCostGroups as number
  return lines <= 200000 && unknownSales <= lines && groups <= lines && unknownCost <= groups
    && (lines === 0) === (groups === 0) && value.Available === (unknownSales === 0 && unknownCost === 0)
    && (unknownSales === 0 ? exactNumber(value.SalesEur) : value.SalesEur === null)
    && (unknownCost === 0 ? exactNumber(value.CostEur) : value.CostEur === null)
    && (lines > 0 || (value.SalesEur as ExactNumber).Numerator === '0' && (value.CostEur as ExactNumber).Numerator === '0')
}
function cells(value: unknown): boolean {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== SALES_MARGIN_COLUMNS[index].Key || typeof cell.Available !== 'boolean') return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.FormattedValue === null
    return decimal(cell.Value) && decimal(cell.FormattedValue) && (index < 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function matchingScope(value: Record<string, unknown>, request: SalesMarginRequest): boolean {
  const periods = salesMarginPeriods(request.Month)
  return value.Version === 1 && identity(value.SourceIdentity) && value.Month === request.Month
    && record(value.CurrentPeriod) && record(value.PreviousPeriod)
    && value.CurrentPeriod.From === periods.CurrentPeriod.From && value.CurrentPeriod.ThroughExclusive === periods.CurrentPeriod.ThroughExclusive
    && value.PreviousPeriod.From === periods.PreviousPeriod.From && value.PreviousPeriod.ThroughExclusive === periods.PreviousPeriod.ThroughExclusive
}
function matchingAvailability(report: SalesMarginReport): boolean {
  const { Current: current, Previous: previous } = report.Inputs
  const currentLines = current.SaleLines + current.ReturnLines, previousLines = previous.SaleLines + previous.ReturnLines
  if (currentLines + previousLines > 200000 || report.Complete !== (current.Available && previous.Available)
    || report.HasRows !== (currentLines + previousLines > 0)) return false
  for (const [index, period] of [current, previous].entries()) {
    const cell = report.Cells[index]
    if (period.SaleLines + period.ReturnLines === 0 && (!cell.Available || cell.Value !== null)
      || period.SaleLines + period.ReturnLines > 0 && cell.Available && cell.Value === null
      || period.UnknownSalesLines > 0 && cell.Available
      || period.UnknownCostGroups > 0 && period.SalesEur?.Numerator !== '0' && cell.Available) return false
  }
  if (!report.Complete) return report.Code === 'input_not_available'
  if (!report.HasRows) return report.Code === 'recorded_empty'
  return report.Code === (report.Cells.every(cell => cell.Available) ? 'available' : 'arithmetic_or_projection_unavailable')
}
function utc(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value) && Number.isFinite(Date.parse(value))
}

/** Only shape, request scope and availability are checked; no financial values are calculated in the browser. */
export function normalizeSalesMarginReport(value: unknown, request: SalesMarginRequest): SalesMarginReport {
  if (!record(value) || !matchingScope(value, request) || !columns(value.Columns) || !cells(value.Cells)
    || !record(value.Inputs) || !input(value.Inputs.Current) || !input(value.Inputs.Previous) || !basis(value)
    || typeof value.Complete !== 'boolean' || typeof value.HasRows !== 'boolean'
    || !utc(value.ObservationStartedAtUtc) || !utc(value.ObservationCompletedAtUtc)
    || Date.parse(value.ObservationCompletedAtUtc) < Date.parse(value.ObservationStartedAtUtc)
    || !hash(value.RequestSha256) || !hash(value.ResultSha256)
    || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string')
    throw new Error('Сервер повернув некоректний результат конструктора або інший місячний період.')
  const report = value as unknown as SalesMarginReport
  if (!matchingAvailability(report)) throw new Error('Сервер повернув некоректний результат конструктора або інший місячний період.')
  return report
}
