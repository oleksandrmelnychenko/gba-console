import type { ReportCatalogueEntry } from '../types'

export const DEBT_TO_SALES_RATIO_SOURCE = {
  World: 'fenix',
  SourceId: '0xa6b50007e90a504c11de09818f4a9358',
  DefinitionSha256: 'd4bed875a518964b29aae5e6b9693fb786d5a4231bf254d6f3710eccad177f44',
} as const
export const DEBT_TO_SALES_RATIO_TITLE = 'Отношение дебиторской задолженности к объему продаж'
export const DEBT_TO_SALES_RATIO_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Предыдущее значение', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const

export type DebtToSalesRatioSourceIdentity = typeof DEBT_TO_SALES_RATIO_SOURCE
export type DebtToSalesRatioColumn = typeof DEBT_TO_SALES_RATIO_COLUMNS[number]
export type DebtToSalesRatioCapabilities = {
  Version: 1
  SourceIdentity: DebtToSalesRatioSourceIdentity
  Title: string
  Executable: boolean
  Periodicity: 'Month'
  PreviousMonthOffset: -1
  Columns: DebtToSalesRatioColumn[]
  Filters: []
}
export type DebtToSalesRatioRequest = {
  Version: 1
  SourceIdentity: DebtToSalesRatioSourceIdentity
  Month: string
}
export type DebtToSalesRatioInput = {
  Available: boolean
  RunId: string | null
  ActiveRows: number
  IncludedRows: number
  UnknownKindRows: number
  Code: string
}
export type DebtToSalesRatioReport = {
  Version: 1
  SourceIdentity: DebtToSalesRatioSourceIdentity
  Month: string
  CurrentPeriod: { From: string; ThroughExclusive: string }
  PreviousPeriod: { From: string; ThroughExclusive: string }
  Columns: DebtToSalesRatioColumn[]
  Cells: Array<{ Key: DebtToSalesRatioColumn['Key']; Value: string | null; Available: boolean }>
  Inputs: { CurrentDebt: DebtToSalesRatioInput; PreviousDebt: DebtToSalesRatioInput; CurrentSales: DebtToSalesRatioInput }
  RequestSha256: string
  ResultSha256: string
  DocumentURL: string
  PdfDocumentURL: string
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const identity = (value: unknown) => record(value)
  && value.World === DEBT_TO_SALES_RATIO_SOURCE.World
  && value.SourceId === DEBT_TO_SALES_RATIO_SOURCE.SourceId
  && value.DefinitionSha256 === DEBT_TO_SALES_RATIO_SOURCE.DefinitionSha256
const columns = (value: unknown) => Array.isArray(value) && value.length === DEBT_TO_SALES_RATIO_COLUMNS.length
  && value.every((column, index) => record(column) && Object.entries(DEBT_TO_SALES_RATIO_COLUMNS[index]).every(([key, expected]) => column[key] === expected))
const decimal = (value: unknown): value is string => typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

/** This source is an original constructor, independent of numeric native dataset mappings. */
export function isDebtToSalesRatioCatalogueEntry(report: ReportCatalogueEntry): boolean {
  return report.Id === `custom:fenix:${DEBT_TO_SALES_RATIO_SOURCE.SourceId}`
    && report.Sources.filter(source => source.World === DEBT_TO_SALES_RATIO_SOURCE.World
      && source.SourceId === DEBT_TO_SALES_RATIO_SOURCE.SourceId).length === 1
}

export function isDebtToSalesRatioCapabilities(value: unknown): value is DebtToSalesRatioCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity)
    && typeof value.Title === 'string' && value.Title.trim().length > 0 && typeof value.Executable === 'boolean'
    && value.Periodicity === 'Month' && value.PreviousMonthOffset === -1 && columns(value.Columns)
    && Array.isArray(value.Filters) && value.Filters.length === 0
}

export function debtToSalesRatioMonthError(month: string): string | null {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000-') || month === '0001-01' || month === '9999-12')
    return 'Оберіть місяць із доступними поточним і попереднім періодами.'
  return null
}

export function debtToSalesRatioPeriods(month: string): Pick<DebtToSalesRatioReport, 'CurrentPeriod' | 'PreviousPeriod'> {
  if (debtToSalesRatioMonthError(month)) throw new Error('Некоректний місячний період звіту.')
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5))
  const shifted = (offset: number) => {
    const index = year * 12 + number - 1 + offset
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01`
  }
  return { CurrentPeriod: { From: shifted(0), ThroughExclusive: shifted(1) }, PreviousPeriod: { From: shifted(-1), ThroughExclusive: shifted(0) } }
}

export function createDebtToSalesRatioRequest(capability: DebtToSalesRatioCapabilities, month: string): DebtToSalesRatioRequest {
  if (!isDebtToSalesRatioCapabilities(capability) || !capability.Executable)
    throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = debtToSalesRatioMonthError(month)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...DEBT_TO_SALES_RATIO_SOURCE }, Month: month }
}

function input(value: unknown): value is DebtToSalesRatioInput {
  return record(value) && typeof value.Available === 'boolean'
    && (value.RunId === null || typeof value.RunId === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value.RunId))
    && count(value.ActiveRows) && count(value.IncludedRows) && count(value.UnknownKindRows)
    && typeof value.Code === 'string'
}

/** Refuse files and cells for a different source/month; NULL is a valid unavailable result. */
export function normalizeDebtToSalesRatioReport(value: unknown, request: DebtToSalesRatioRequest): DebtToSalesRatioReport {
  const periods = debtToSalesRatioPeriods(request.Month)
  if (!record(value) || value.Version !== 1 || !identity(value.SourceIdentity) || value.Month !== request.Month
    || !columns(value.Columns) || !record(value.CurrentPeriod) || !record(value.PreviousPeriod)
    || value.CurrentPeriod.From !== periods.CurrentPeriod.From || value.CurrentPeriod.ThroughExclusive !== periods.CurrentPeriod.ThroughExclusive
    || value.PreviousPeriod.From !== periods.PreviousPeriod.From || value.PreviousPeriod.ThroughExclusive !== periods.PreviousPeriod.ThroughExclusive
    || !Array.isArray(value.Cells) || value.Cells.length !== 4
    || !value.Cells.every((cell, index) => record(cell) && cell.Key === DEBT_TO_SALES_RATIO_COLUMNS[index].Key
      && typeof cell.Available === 'boolean' && (cell.Available ? decimal(cell.Value) : cell.Value === null))
    || !record(value.Inputs) || !input(value.Inputs.CurrentDebt) || !input(value.Inputs.PreviousDebt) || !input(value.Inputs.CurrentSales)
    || typeof value.RequestSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.RequestSha256)
    || typeof value.ResultSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.ResultSha256)
    || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string')
    throw new Error('Сервер повернув некоректний результат конструктора або інший місячний період.')
  return value as unknown as DebtToSalesRatioReport
}

export function debtToSalesRatioCellText(value: string | null, decimalPlaces: number | null): string {
  if (value === null) return '—'
  if (decimalPlaces === null) return value.replace('.', ',')
  const negative = value.startsWith('-')
  const [integer, fraction = ''] = (negative ? value.slice(1) : value).split('.')
  // Round presentation only, using the absolute decimal coefficient for halfway-away-from-zero.
  let coefficient = BigInt(integer + fraction.slice(0, decimalPlaces).padEnd(decimalPlaces, '0'))
  if (fraction.length > decimalPlaces && fraction[decimalPlaces] >= '5') coefficient += 1n
  const digits = coefficient.toString().padStart(decimalPlaces + 1, '0')
  const split = digits.length - decimalPlaces
  return `${negative ? '-' : ''}${digits.slice(0, split)}${decimalPlaces ? `,${digits.slice(split)}` : ''}`
}
