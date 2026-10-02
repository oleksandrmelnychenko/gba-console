import type { ReportCatalogueEntry } from '../types'
import { debtToSalesRatioCellText } from './debtToSalesRatio'

export const COLLECTION_COEFFICIENT_SOURCE = {
  World: 'fenix',
  SourceId: '0xa6b50007e90a504c11de095c3a096238',
  DefinitionSha256: '9ad83fb0551b26373976006a25535b903929a150eeb136d66ff8075faff7a787',
} as const
export const COLLECTION_COEFFICIENT_TITLE = 'Коэффициент инкассации дебиторской задолженности текущего периода'
export const COLLECTION_COEFFICIENT_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: 2 },
] as const

export type CollectionCoefficientCapabilities = {
  Version: 1
  SourceIdentity: typeof COLLECTION_COEFFICIENT_SOURCE
  Title: string
  Executable: boolean
  Periodicity: 'Month'
  PreviousMonthOffset: -1
  Columns: Array<typeof COLLECTION_COEFFICIENT_COLUMNS[number]>
  Filters: []
}
export type CollectionCoefficientRequest = {
  Version: 1
  SourceIdentity: typeof COLLECTION_COEFFICIENT_SOURCE
  Month: string
}
export type CollectionCoefficientInput = {
  Available: boolean
  RunId: string | null
  CoefficientSum: string | null
  PhysicalRows: number
  ActiveRows: number
  IncludedRows: number
  GrainRows: number
  UnknownBuyerRows: number
  InvalidRows: number
  Code: string
}
export type CollectionCoefficientReport = {
  Version: 1
  SourceIdentity: typeof COLLECTION_COEFFICIENT_SOURCE
  Month: string
  CurrentPeriod: { From: string; ThroughExclusive: string }
  PreviousPeriod: { From: string; ThroughExclusive: string }
  Columns: Array<typeof COLLECTION_COEFFICIENT_COLUMNS[number]>
  Cells: Array<{ Key: typeof COLLECTION_COEFFICIENT_COLUMNS[number]['Key']; Value: string | null; Available: boolean }>
  Inputs: { Current: CollectionCoefficientInput; Previous: CollectionCoefficientInput }
  Complete: boolean
  HasRows: boolean
  Code: string
  RequestSha256: string
  ResultSha256: string
  DocumentURL: string
  PdfDocumentURL: string
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const hash = (value: unknown) => typeof value === 'string' && /^[\da-f]{64}$/i.test(value)
const identity = (value: unknown) => record(value)
  && Object.entries(COLLECTION_COEFFICIENT_SOURCE).every(([key, expected]) => value[key] === expected)
const columns = (value: unknown) => Array.isArray(value) && value.length === 4
  && value.every((column, index) => record(column) && Object.entries(COLLECTION_COEFFICIENT_COLUMNS[index]).every(([key, expected]) => column[key] === expected))

export function isCollectionCoefficientCatalogueEntry(report: ReportCatalogueEntry): boolean {
  return report.Id === `custom:fenix:${COLLECTION_COEFFICIENT_SOURCE.SourceId}`
    && report.Sources.filter(source => source.World === COLLECTION_COEFFICIENT_SOURCE.World
      && source.SourceId === COLLECTION_COEFFICIENT_SOURCE.SourceId).length === 1
}

export function isCollectionCoefficientCapabilities(value: unknown): value is CollectionCoefficientCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity)
    && typeof value.Title === 'string' && value.Title.trim().length > 0 && typeof value.Executable === 'boolean'
    && value.Periodicity === 'Month' && value.PreviousMonthOffset === -1 && columns(value.Columns)
    && Array.isArray(value.Filters) && value.Filters.length === 0
}

export function collectionCoefficientMonthError(month: string): string | null {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month <= '0001-01' || month >= '7999-12')
    return 'Оберіть місяць із доступними поточним і попереднім періодами.'
  return null
}

export function collectionCoefficientPeriods(month: string): Pick<CollectionCoefficientReport, 'CurrentPeriod' | 'PreviousPeriod'> {
  if (collectionCoefficientMonthError(month)) throw new Error('Некоректний місячний період звіту.')
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5))
  const shifted = (offset: number) => {
    const index = year * 12 + number - 1 + offset
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01`
  }
  return { CurrentPeriod: { From: shifted(0), ThroughExclusive: shifted(1) }, PreviousPeriod: { From: shifted(-1), ThroughExclusive: shifted(0) } }
}

export function createCollectionCoefficientRequest(capability: CollectionCoefficientCapabilities, month: string): CollectionCoefficientRequest {
  if (!isCollectionCoefficientCapabilities(capability) || !capability.Executable)
    throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = collectionCoefficientMonthError(month)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...COLLECTION_COEFFICIENT_SOURCE }, Month: month }
}

function input(value: unknown): value is CollectionCoefficientInput {
  if (!record(value) || typeof value.Available !== 'boolean' || typeof value.Code !== 'string') return false
  const counts = [value.PhysicalRows, value.ActiveRows, value.IncludedRows, value.GrainRows, value.UnknownBuyerRows, value.InvalidRows]
  if (!counts.every(count)) return false
  const [physical, active, included, grain, unknown, invalid] = counts as number[]
  if (active > physical || included > active || grain > included || unknown > active || invalid > physical) return false
  const runId = value.RunId
  if (runId !== null && (typeof runId !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(runId) || /^0{8}-(?:0{4}-){3}0{12}$/.test(runId))) return false
  if (!value.Available) return value.CoefficientSum === null
  return runId !== null && unknown === 0 && invalid === 0
    && (grain === 0) === (included === 0)
    && (grain === 0 ? value.CoefficientSum === null : decimal(value.CoefficientSum))
}

function matchingScope(value: Record<string, unknown>, request: CollectionCoefficientRequest): boolean {
  const periods = collectionCoefficientPeriods(request.Month)
  return value.Version === 1 && identity(value.SourceIdentity) && value.Month === request.Month
    && record(value.CurrentPeriod) && record(value.PreviousPeriod)
    && value.CurrentPeriod.From === periods.CurrentPeriod.From && value.CurrentPeriod.ThroughExclusive === periods.CurrentPeriod.ThroughExclusive
    && value.PreviousPeriod.From === periods.PreviousPeriod.From && value.PreviousPeriod.ThroughExclusive === periods.PreviousPeriod.ThroughExclusive
}

function matchingCells(value: unknown): boolean {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => record(cell)
    && cell.Key === COLLECTION_COEFFICIENT_COLUMNS[index].Key && typeof cell.Available === 'boolean'
    && (cell.Value === null || cell.Available && decimal(cell.Value)))
}

function matchingAvailability(value: CollectionCoefficientReport): boolean {
  const { Current: current, Previous: previous } = value.Inputs
  if (value.Complete !== (current.Available && previous.Available)) return false
  if (value.Cells[0].Available !== current.Available || value.Cells[1].Available !== previous.Available) return false
  if (current.Available && (current.GrainRows === 0) !== (value.Cells[0].Value === null)) return false
  if (previous.Available && (previous.GrainRows === 0) !== (value.Cells[1].Value === null)) return false
  if (!value.Complete && value.Cells.slice(2).some(cell => cell.Available || cell.Value !== null)) return false
  if (value.Complete && value.HasRows !== (current.GrainRows > 0 || previous.GrainRows > 0)) return false
  if (value.Complete && !value.HasRows)
    return current.GrainRows === 0 && previous.GrainRows === 0 && value.Cells.every(cell => cell.Value === null)
  return true
}

/** Confirmed empty data can have a logical NULL; missing data never acquires a numeric value. */
export function normalizeCollectionCoefficientReport(value: unknown, request: CollectionCoefficientRequest): CollectionCoefficientReport {
  if (!record(value) || !matchingScope(value, request) || !columns(value.Columns) || !matchingCells(value.Cells)
    || !record(value.Inputs) || !input(value.Inputs.Current) || !input(value.Inputs.Previous)
    || typeof value.Complete !== 'boolean' || typeof value.HasRows !== 'boolean' || typeof value.Code !== 'string'
    || !hash(value.RequestSha256) || !hash(value.ResultSha256)
    || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string')
    throw new Error('Сервер повернув некоректний результат конструктора або інший місячний період.')
  const report = value as unknown as CollectionCoefficientReport
  if (!matchingAvailability(report))
    throw new Error('Сервер повернув некоректний результат конструктора або інший місячний період.')
  return report
}

/** Presentation uses decimal strings and never converts financial values to a JavaScript number. */
export const collectionCoefficientCellText = debtToSalesRatioCellText
