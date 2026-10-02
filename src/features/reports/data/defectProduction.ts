import { isManagementReturnsDocumentUrl } from './managementReturns'
import type { ReportCatalogueEntry } from '../types'

export const DEFECT_PRODUCTION_SOURCE = { World: 'fenix', SourceId: '0xa6b50007e90a504c11de09a53a27c968',
  DefinitionSha256: '693a0b2e96f69b6df29337439511971c1669ea86171f12d7e3f0fa43165b905b' } as const
export const DEFECT_PRODUCTION_ROUTE = '/report/constructors/defect-production'
export const DEFECT_PRODUCTION_NAME = 'Брак к объему производства, %'
export const DEFECT_PRODUCTION_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Предыдущее значение', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
export const DEFECT_PRODUCTION_BASIS = {
  InputBasis: 'NormalFenixProduction30', RawVisibilityPolicy: 'ActiveSignedProductionTurnover',
  QueryPolicy: 'Full10GrainThenProjected8UnionDistinct', QualityPolicy: 'ObservedPredefinedNewPhysicalReference',
  EmptyQueryPolicy: 'RetainedScalarEmptySumNull', PlannedCostResourceUnit: '(Упр)',
  ResultUnit: 'DimensionlessRatioWithoutPercentScaling', EffectiveSourcePeriodsVerified: false, SourceParityVerified: false,
  NativeVirtualTableZeroSuppressionVerified: false, NativeEmptyQueryRowsVerified: false, AppliesFxConversion: false,
} as const
export type DefectProductionPeriod = { From: string; ThroughExclusive: string }
export type DefectProductionWindows = { CurrentPeriod: DefectProductionPeriod; PreviousPeriod: DefectProductionPeriod }
export type DefectProductionCapabilities = typeof DEFECT_PRODUCTION_BASIS & {
  Version: 1; SourceIdentity: typeof DEFECT_PRODUCTION_SOURCE; ReportName: typeof DEFECT_PRODUCTION_NAME
  Periodicity: 'Month'; ScopeKind: 'CurrentGbaMonthAndPreviousMonth'; Grouping: 'Scalar'
  Columns: Array<typeof DEFECT_PRODUCTION_COLUMNS[number]>; Filters: ['Month']
  RuntimeImplemented: boolean; RequiresCompleteNormalPublications: true; InputAvailability: 'CheckedByPreview'
}
export type DefectProductionRequest = { Version: 1; SourceIdentity: typeof DEFECT_PRODUCTION_SOURCE; Month: string }
export type DefectProductionCell = {
  Key: typeof DEFECT_PRODUCTION_COLUMNS[number]['Key']; Value: string | null; Available: boolean
  ExactValue: { Numerator: string; Denominator: string } | null; FormattedValue: string | null
}
export type DefectProductionInput = { Available: boolean; IncludedRows: number | null; Code: string }
export type DefectProductionPublication = { BusinessMonth: string; RunId: string | null; Available: boolean
  PhysicalRows: number | null; PagesPerPass: number | null; CompletePassSha256: string | null; Code: string }
export type DefectProductionReport = typeof DEFECT_PRODUCTION_BASIS & DefectProductionWindows & {
  Version: 1; SourceIdentity: typeof DEFECT_PRODUCTION_SOURCE; Month: string; Columns: Array<typeof DEFECT_PRODUCTION_COLUMNS[number]>
  Cells: DefectProductionCell[]; Inputs: { Current: DefectProductionInput; Previous: DefectProductionInput }
  Complete: boolean; HasRows: boolean; Code: 'available' | 'published_empty' | 'production_input_unavailable' | 'decimal_projection_unavailable'
  PresentationBasis: 'CurrentGbaClrDecimal'; ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string
  Proof: { Publications: DefectProductionPublication[]; ObservationSha256: string; SnapshotVerified: true }
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const code = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1024 && value === value.trim()
const guid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
function identity(value: unknown): boolean { return record(value) && Object.entries(DEFECT_PRODUCTION_SOURCE).every(([key, expected]) => value[key] === expected) }
function columns(value: unknown): boolean { return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(DEFECT_PRODUCTION_COLUMNS[index]).every(([key, expected]) => column[key] === expected)) }
function basis(value: Record<string, unknown>): boolean { return Object.entries(DEFECT_PRODUCTION_BASIS).every(([key, expected]) => value[key] === expected) }
export function isDefectProductionCatalogueEntry(report: ReportCatalogueEntry): boolean {
  const sources = report.Sources.filter(source => source.World === DEFECT_PRODUCTION_SOURCE.World && source.SourceId === DEFECT_PRODUCTION_SOURCE.SourceId)
  return report.Id === `custom:fenix:${DEFECT_PRODUCTION_SOURCE.SourceId}` && sources.length === 1
    && (sources[0].DefinitionSha256 === null || sources[0].DefinitionSha256 === DEFECT_PRODUCTION_SOURCE.DefinitionSha256)
}
export function isDefectProductionCapabilities(value: unknown): value is DefectProductionCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && value.ReportName === DEFECT_PRODUCTION_NAME
    && value.Periodicity === 'Month' && value.ScopeKind === 'CurrentGbaMonthAndPreviousMonth' && value.Grouping === 'Scalar'
    && basis(value) && columns(value.Columns) && Array.isArray(value.Filters) && value.Filters.length === 1 && value.Filters[0] === 'Month'
    && typeof value.RuntimeImplemented === 'boolean' && value.RequiresCompleteNormalPublications === true && value.InputAvailability === 'CheckedByPreview'
}
/** Calendar validation only. All values, ratios and display strings remain server supplied. */
export function defectProductionMonthError(month: string): string | null {
  return typeof month !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month <= '0001-01' || month >= '7999-12'
    ? 'Оберіть допустимий місяць для порівняння браку.' : null
}
function monthStart(index: number): string {
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01T00:00:00.000`
}
export function defectProductionWindows(month: string): DefectProductionWindows {
  if (defectProductionMonthError(month)) throw invalidDefectProduction()
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1
  return { CurrentPeriod: { From: monthStart(index), ThroughExclusive: monthStart(index + 1) },
    PreviousPeriod: { From: monthStart(index - 1), ThroughExclusive: monthStart(index) } }
}
export function createDefectProductionRequest(capability: DefectProductionCapabilities, month: string): DefectProductionRequest {
  if (!isDefectProductionCapabilities(capability) || !capability.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = defectProductionMonthError(month)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...DEFECT_PRODUCTION_SOURCE }, Month: month }
}
function exact(value: unknown): boolean { return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
  && value.Numerator.length <= 20000 && value.Denominator.length <= 20000 && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator)
  && /^[1-9]\d*$/.test(value.Denominator) && (value.Numerator !== '0' || value.Denominator === '1') }
function cells(value: unknown): value is DefectProductionCell[] {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== DEFECT_PRODUCTION_COLUMNS[index].Key || typeof cell.Available !== 'boolean'
      || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.ExactValue === null && cell.FormattedValue === null
    return exact(cell.ExactValue) && decimal(cell.Value) && decimal(cell.FormattedValue) && (index !== 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function input(value: unknown): value is DefectProductionInput { return record(value) && typeof value.Available === 'boolean' && code(value.Code)
  && (value.Available ? count(value.IncludedRows) && value.IncludedRows <= 200000 && value.Code === (value.IncludedRows === 0 ? 'query_empty' : 'available') : value.IncludedRows === null) }
function publication(value: unknown): value is DefectProductionPublication {
  if (!record(value) || typeof value.Available !== 'boolean' || !code(value.Code)
    || !(value.RunId === null || guid(value.RunId)) || !(value.PhysicalRows === null || count(value.PhysicalRows) && value.PhysicalRows <= 200000)
    || !(value.PagesPerPass === null || count(value.PagesPerPass) && value.PagesPerPass > 0 && value.PagesPerPass <= 782)
    || !(value.CompletePassSha256 === null || hash(value.CompletePassSha256))) return false
  if (value.Available && (!guid(value.RunId) || !count(value.PhysicalRows) || !count(value.PagesPerPass) || !hash(value.CompletePassSha256))) return false
  return !count(value.PhysicalRows) || !count(value.PagesPerPass) || value.PagesPerPass === Math.max(1, Math.ceil(value.PhysicalRows / 256))
}
function proof(value: unknown, request: DefectProductionRequest, inputs: DefectProductionReport['Inputs']): boolean {
  if (!record(value) || value.SnapshotVerified !== true || !hash(value.ObservationSha256) || !Array.isArray(value.Publications) || value.Publications.length !== 2) return false
  const windows = defectProductionWindows(request.Month), expected = [windows.PreviousPeriod.From.slice(0, 10), windows.CurrentPeriod.From.slice(0, 10)]
  const selected = [inputs.Previous, inputs.Current], seen = new Set<string>()
  return value.Publications.every((parent, index) => {
    if (!publication(parent) || parent.BusinessMonth !== expected[index]) return false
    if (parent.RunId !== null) { if (seen.has(parent.RunId.toLowerCase())) return false; seen.add(parent.RunId.toLowerCase()) }
    const input = selected[index]
    return !input.Available || parent.Available && count(parent.PhysicalRows) && count(input.IncludedRows) && input.IncludedRows <= parent.PhysicalRows
  })
}
function utc(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 23) === value.slice(0, 23) }
function envelope(value: unknown, request: DefectProductionRequest): value is DefectProductionReport {
  if (!record(request) || request.Version !== 1 || !identity(request.SourceIdentity) || defectProductionMonthError(request.Month)) return false
  const windows = defectProductionWindows(request.Month)
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && value.Month === request.Month && basis(value) && value.PresentationBasis === 'CurrentGbaClrDecimal'
    && columns(value.Columns) && record(value.CurrentPeriod) && record(value.PreviousPeriod)
    && value.CurrentPeriod.From === windows.CurrentPeriod.From && value.CurrentPeriod.ThroughExclusive === windows.CurrentPeriod.ThroughExclusive
    && value.PreviousPeriod.From === windows.PreviousPeriod.From && value.PreviousPeriod.ThroughExclusive === windows.PreviousPeriod.ThroughExclusive
    && record(value.Inputs) && input(value.Inputs.Current) && input(value.Inputs.Previous) && cells(value.Cells)
    && typeof value.Complete === 'boolean' && typeof value.HasRows === 'boolean'
    && utc(value.ObservationStartedAtUtc) && utc(value.ObservationCompletedAtUtc) && value.ObservationStartedAtUtc <= value.ObservationCompletedAtUtc
    && hash(value.RequestSha256) && hash(value.ResultSha256) && isManagementReturnsDocumentUrl(value.DocumentURL) && isManagementReturnsDocumentUrl(value.PdfDocumentURL)
}
function rawAvailability(report: DefectProductionReport): boolean {
  return [report.Inputs.Current, report.Inputs.Previous].every((input, index) => {
    const cell = report.Cells[index]
    if (!input.Available) return !cell.Available && cell.ExactValue === null
    if (input.IncludedRows === 0) return cell.Available && cell.Value === null
    return cell.Value !== null || !cell.Available && cell.ExactValue !== null
  })
}
/** Validate identity, whole-month parents and scalar availability, without recalculating any financial value. */
export function normalizeDefectProductionReport(value: unknown, request: DefectProductionRequest): DefectProductionReport {
  if (!envelope(value, request) || !proof(value.Proof, request, value.Inputs) || !rawAvailability(value)) throw invalidDefectProduction()
  const current = value.Inputs.Current, previous = value.Inputs.Previous
  const hasRows = [current, previous].some(input => input.Available && count(input.IncludedRows) && input.IncludedRows > 0)
  if (value.Complete !== (current.Available && previous.Available) || value.HasRows !== hasRows
    || !value.Complete && value.Cells[3].Available || !previous.Available && value.Cells[2].Available
    || value.Complete && !hasRows && (!value.Cells[2].Available || !value.Cells[3].Available)) throw invalidDefectProduction()
  const expected = !value.Complete ? 'production_input_unavailable' : value.Cells.some(cell => !cell.Available) ? 'decimal_projection_unavailable'
    : !hasRows ? 'published_empty' : 'available'
  if (value.Code !== expected) throw invalidDefectProduction()
  return value
}
export function invalidDefectProduction() { return new Error('Сервер повернув непідтверджений результат браку або інший місяць.') }
