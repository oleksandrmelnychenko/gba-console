import type { ReportCatalogueEntry } from '../types'
import { debtToSalesRatioCellText, debtToSalesRatioMonthError, debtToSalesRatioPeriods } from './debtToSalesRatio'

export const ACTIVE_CLIENTS_SOURCE = {
  World: 'fenix',
  SourceId: '0xb4b500055d78a52511ddfe73b936bfac',
  DefinitionSha256: 'e0521154862cbf0bba9f9e5d3c99c4d18f7e6a22715accb8280e40f11809feed',
} as const
export const ACTIVE_CLIENTS_TITLE = 'Количество активных клиентов'
export const ACTIVE_CLIENTS_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Предыдущее значение', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const

export type ActiveClientsSourceIdentity = typeof ACTIVE_CLIENTS_SOURCE
export type ActiveClientsColumn = typeof ACTIVE_CLIENTS_COLUMNS[number]
type ActiveClientsBasis = {
  IdentityBasis: 'CurrentOurClient'
  IncludesPostedSaleAndReturnLines: true
  SourceParityVerified: false
}
export type ActiveClientsCapabilities = ActiveClientsBasis & {
  Version: 1
  SourceIdentity: ActiveClientsSourceIdentity
  Title: string
  Executable: boolean
  Periodicity: 'Month'
  PreviousMonthOffset: -1
  Columns: ActiveClientsColumn[]
  Filters: []
}
export type ActiveClientsRequest = {
  Version: 1
  SourceIdentity: ActiveClientsSourceIdentity
  Month: string
}
export type ActiveClientsInput = {
  Available: boolean
  EligibleSaleLines: number
  EligibleReturnLines: number
  UnattributedLines: number
  DistinctClients: number | null
  Code: 'available' | 'client_attribution_unavailable'
}
export type ActiveClientsReport = ActiveClientsBasis & {
  Version: 1
  SourceIdentity: ActiveClientsSourceIdentity
  Month: string
  CurrentPeriod: { From: string; ThroughExclusive: string }
  PreviousPeriod: { From: string; ThroughExclusive: string }
  Columns: ActiveClientsColumn[]
  Cells: Array<{ Key: ActiveClientsColumn['Key']; Value: string | null; Available: boolean }>
  Inputs: { Current: ActiveClientsInput; Previous: ActiveClientsInput }
  ObservationStartedAtUtc: string
  ObservationCompletedAtUtc: string
  RequestSha256: string
  ResultSha256: string
  DocumentURL: string
  PdfDocumentURL: string
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const identity = (value: unknown) => record(value)
  && value.World === ACTIVE_CLIENTS_SOURCE.World && value.SourceId === ACTIVE_CLIENTS_SOURCE.SourceId
  && value.DefinitionSha256 === ACTIVE_CLIENTS_SOURCE.DefinitionSha256
const columns = (value: unknown) => Array.isArray(value) && value.length === ACTIVE_CLIENTS_COLUMNS.length
  && value.every((column, index) => record(column) && Object.entries(ACTIVE_CLIENTS_COLUMNS[index]).every(([key, expected]) => column[key] === expected))
const decimal = (value: unknown): value is string => typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const basis = (value: Record<string, unknown>) => value.IdentityBasis === 'CurrentOurClient'
  && value.IncludesPostedSaleAndReturnLines === true && value.SourceParityVerified === false
const utc = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value)

/** The original source identity has its own capability, independent of native datasets 12/13. */
export function isActiveClientsCatalogueEntry(report: ReportCatalogueEntry): boolean {
  return report.Id === `custom:fenix:${ACTIVE_CLIENTS_SOURCE.SourceId}`
    && report.Sources.filter(source => source.World === ACTIVE_CLIENTS_SOURCE.World && source.SourceId === ACTIVE_CLIENTS_SOURCE.SourceId).length === 1
}

export function isActiveClientsCapabilities(value: unknown): value is ActiveClientsCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && basis(value)
    && value.Title === ACTIVE_CLIENTS_TITLE && typeof value.Executable === 'boolean'
    && value.Periodicity === 'Month' && value.PreviousMonthOffset === -1 && columns(value.Columns)
    && Array.isArray(value.Filters) && value.Filters.length === 0
}

// Calendar boundaries and decimal presentation are shared; all counts and arithmetic come from this report's server.
export const activeClientsMonthError = debtToSalesRatioMonthError
export const activeClientsPeriods = debtToSalesRatioPeriods
export const activeClientsCellText = debtToSalesRatioCellText

export function createActiveClientsRequest(capability: ActiveClientsCapabilities, month: string): ActiveClientsRequest {
  if (!isActiveClientsCapabilities(capability) || !capability.Executable)
    throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = activeClientsMonthError(month)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...ACTIVE_CLIENTS_SOURCE }, Month: month }
}

function input(value: unknown): value is ActiveClientsInput {
  return record(value) && typeof value.Available === 'boolean'
    && count(value.EligibleSaleLines) && count(value.EligibleReturnLines) && count(value.UnattributedLines)
    && (value.Available ? count(value.DistinctClients) && value.Code === 'available'
      : value.DistinctClients === null && value.Code === 'client_attribution_unavailable')
}

/** Keep observed empty zero and missing attribution NULL distinct; never recompute the four server cells. */
export function normalizeActiveClientsReport(value: unknown, request: ActiveClientsRequest): ActiveClientsReport {
  const periods = activeClientsPeriods(request.Month)
  if (!record(value) || value.Version !== 1 || !identity(value.SourceIdentity) || !basis(value) || value.Month !== request.Month
    || !columns(value.Columns) || !record(value.CurrentPeriod) || !record(value.PreviousPeriod)
    || value.CurrentPeriod.From !== periods.CurrentPeriod.From || value.CurrentPeriod.ThroughExclusive !== periods.CurrentPeriod.ThroughExclusive
    || value.PreviousPeriod.From !== periods.PreviousPeriod.From || value.PreviousPeriod.ThroughExclusive !== periods.PreviousPeriod.ThroughExclusive
    || !Array.isArray(value.Cells) || value.Cells.length !== 4
    || !value.Cells.every((cell, index) => record(cell) && cell.Key === ACTIVE_CLIENTS_COLUMNS[index].Key
      && typeof cell.Available === 'boolean' && (cell.Available ? decimal(cell.Value) : cell.Value === null))
    || !record(value.Inputs) || !input(value.Inputs.Current) || !input(value.Inputs.Previous)
    || !utc(value.ObservationStartedAtUtc) || !utc(value.ObservationCompletedAtUtc)
    || typeof value.RequestSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.RequestSha256)
    || typeof value.ResultSha256 !== 'string' || !/^[\da-f]{64}$/i.test(value.ResultSha256)
    || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string')
    throw new Error('Сервер повернув некоректний результат конструктора або інший місячний період.')
  return value as unknown as ActiveClientsReport
}
