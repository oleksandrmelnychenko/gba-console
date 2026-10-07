import { isManagementReturnsDocumentUrl } from './managementReturns'
import type { ReportCatalogueEntry } from '../types'

// Catalogue selection only. Request identity and version are copied from the actual server capability.
export const INVENTORY_TURNOVER_CATALOGUE_SOURCE = { World: 'fenix', SourceId: '0xa6b50007e90a504c11de09a53a27c96a' } as const
export const INVENTORY_TURNOVER_ROUTE = '/report/constructors/inventory-turnover'
export const INVENTORY_TURNOVER_NAME = 'Совокупная оборачиваемость запасов, дни'
export const INVENTORY_TURNOVER_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Предыдущее значение', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
export const INVENTORY_TURNOVER_UNITS = [
  { Relation: 'Warehouse', SourceCaption: 'Стоимость', SourceUnitAnnotation: '(Упр)' },
  { Relation: 'RetailNtt', SourceCaption: 'Сумма', SourceUnitAnnotation: '(грн)' },
] as const
export const INVENTORY_TURNOVER_BASIS = { InputBasis: 'CurrentOurSyncedInventory', ResultUnit: 'DimensionlessRatio',
  EffectiveSourcePeriodsVerified: false, SourceParityVerified: false, NativeVirtualTableZeroSuppressionVerified: false, AppliesFxConversion: false } as const
export type InventoryTurnoverIdentity = { World: string; SourceId: string; DefinitionSha256: string }
export type InventoryTurnoverPeriod = { From: string; ThroughExclusive: string }
export type InventoryTurnoverWindows = { CurrentPeriod: InventoryTurnoverPeriod; PreviousPeriod: InventoryTurnoverPeriod }
export type InventoryTurnoverCapabilities = typeof INVENTORY_TURNOVER_BASIS & {
  Version: 1; SourceIdentity: InventoryTurnoverIdentity; ReportName: typeof INVENTORY_TURNOVER_NAME
  ScopeKind: 'CurrentGbaMonthAndPreviousMonth'; Periodicity: 'Month'; Grouping: 'Scalar'; Filters: ['Month']
  Columns: Array<typeof INVENTORY_TURNOVER_COLUMNS[number]>; ResourceUnits: Array<typeof INVENTORY_TURNOVER_UNITS[number]>
  RuntimeImplemented: boolean; RequiresCompleteNormalPublications: true; InputAvailability: 'CheckedByPreview'
}
export type InventoryTurnoverRequest = { Version: 1; SourceIdentity: InventoryTurnoverIdentity; Month: string }
export type InventoryTurnoverCell = { Key: typeof INVENTORY_TURNOVER_COLUMNS[number]['Key']; Value: string | null; Available: boolean
  ExactValue: { Numerator: string; Denominator: string } | null; FormattedValue: string | null }
export type InventoryTurnoverInput = { Complete: boolean; CoverageComplete: boolean; ScalarDefined: boolean; IncludedRows: number | null; Code: string }
export type InventoryTurnoverProof = { InputWitnessSha256: string; SnapshotVerified: true; CurrentCompletePublication: boolean
  PreviousCompletePublication: boolean; ComparisonIdentityStatus: 'Compatible' | 'Conflict' | 'Unverified'; ComparisonSourceIdentityCompatible: boolean }
export type InventoryTurnoverReport = typeof INVENTORY_TURNOVER_BASIS & InventoryTurnoverWindows & {
  Version: 1; SourceIdentity: InventoryTurnoverIdentity; Month: string; Columns: Array<typeof INVENTORY_TURNOVER_COLUMNS[number]>
  ResourceUnits: Array<typeof INVENTORY_TURNOVER_UNITS[number]>; Cells: InventoryTurnoverCell[]
  Inputs: { Current: InventoryTurnoverInput; Previous: InventoryTurnoverInput }; Complete: boolean; HasRows: boolean; Code: string
  AvailabilityMessage: string | null; PresentationBasis: 'CurrentGbaClrDecimal'; Proof: InventoryTurnoverProof
  ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string; RequestSha256: string; ResultSha256: string
  DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1024 && value === value.trim()
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 200000
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
function identity(value: unknown): value is InventoryTurnoverIdentity {
  return record(value) && Object.keys(value).length === 3 && text(value.World)
    && typeof value.SourceId === 'string' && /^0x[0-9a-f]{32}$/.test(value.SourceId) && hash(value.DefinitionSha256)
}
function sameIdentity(value: unknown, expected: InventoryTurnoverIdentity): boolean {
  return identity(value) && value.World === expected.World && value.SourceId === expected.SourceId && value.DefinitionSha256 === expected.DefinitionSha256
}
function columns(value: unknown): boolean { return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(INVENTORY_TURNOVER_COLUMNS[index]).every(([key, expected]) => column[key] === expected)) }
function units(value: unknown): boolean { return Array.isArray(value) && value.length === 2 && value.every((unit, index) => record(unit)
  && Object.entries(INVENTORY_TURNOVER_UNITS[index]).every(([key, expected]) => unit[key] === expected)) }
function basis(value: Record<string, unknown>): boolean { return Object.entries(INVENTORY_TURNOVER_BASIS).every(([key, expected]) => value[key] === expected) }
export function isInventoryTurnoverCatalogueEntry(report: ReportCatalogueEntry): boolean {
  const sources = report.Sources.filter(source => source.World === INVENTORY_TURNOVER_CATALOGUE_SOURCE.World && source.SourceId === INVENTORY_TURNOVER_CATALOGUE_SOURCE.SourceId)
  return report.Id === `custom:fenix:${INVENTORY_TURNOVER_CATALOGUE_SOURCE.SourceId}` && sources.length === 1
    && (sources[0].DefinitionSha256 === null || hash(sources[0].DefinitionSha256))
}
export function inventoryTurnoverCatalogueMatches(report: ReportCatalogueEntry, capability: InventoryTurnoverCapabilities): boolean {
  if (!isInventoryTurnoverCatalogueEntry(report) || !isInventoryTurnoverCapabilities(capability)) return false
  const source = report.Sources.find(source => source.World === capability.SourceIdentity.World && source.SourceId === capability.SourceIdentity.SourceId)
  return Boolean(source && (source.DefinitionSha256 === null || source.DefinitionSha256 === capability.SourceIdentity.DefinitionSha256))
}
export function isInventoryTurnoverCapabilities(value: unknown): value is InventoryTurnoverCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity)
    && value.SourceIdentity.World === INVENTORY_TURNOVER_CATALOGUE_SOURCE.World && value.SourceIdentity.SourceId === INVENTORY_TURNOVER_CATALOGUE_SOURCE.SourceId
    && value.ReportName === INVENTORY_TURNOVER_NAME && value.ScopeKind === 'CurrentGbaMonthAndPreviousMonth' && value.Periodicity === 'Month'
    && value.Grouping === 'Scalar' && basis(value) && columns(value.Columns) && units(value.ResourceUnits)
    && Array.isArray(value.Filters) && value.Filters.length === 1 && value.Filters[0] === 'Month' && typeof value.RuntimeImplemented === 'boolean'
    && value.RequiresCompleteNormalPublications === true && value.InputAvailability === 'CheckedByPreview'
}
/** Calendar validation only, following the actual server/normal input date domain. */
export function inventoryTurnoverMonthError(month: string): string | null {
  return typeof month !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month <= '0001-02' || month >= '3999-01'
    ? 'Оберіть допустимий календарний місяць звіту.' : null
}
function monthStart(index: number): string { return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01` }
export function inventoryTurnoverWindows(month: string): InventoryTurnoverWindows {
  if (inventoryTurnoverMonthError(month)) throw invalidInventoryTurnover()
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1
  return { CurrentPeriod: { From: monthStart(index), ThroughExclusive: monthStart(index + 1) },
    PreviousPeriod: { From: monthStart(index - 1), ThroughExclusive: monthStart(index) } }
}
export function createInventoryTurnoverRequest(capability: InventoryTurnoverCapabilities, month: string): InventoryTurnoverRequest {
  if (!isInventoryTurnoverCapabilities(capability) || !capability.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = inventoryTurnoverMonthError(month); if (error) throw new Error(error)
  return { Version: capability.Version, SourceIdentity: { ...capability.SourceIdentity }, Month: month }
}
function exact(value: unknown): boolean { return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
  && value.Numerator.length <= 20000 && value.Denominator.length <= 20000 && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator)
  && /^[1-9]\d*$/.test(value.Denominator) && (value.Numerator !== '0' || value.Denominator === '1') }
function cells(value: unknown): value is InventoryTurnoverCell[] {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== INVENTORY_TURNOVER_COLUMNS[index].Key || typeof cell.Available !== 'boolean'
      || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.ExactValue === null && cell.FormattedValue === null
    return exact(cell.ExactValue) && decimal(cell.Value) && decimal(cell.FormattedValue) && (index !== 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function input(value: unknown): value is InventoryTurnoverInput {
  if (!record(value) || typeof value.Complete !== 'boolean' || typeof value.CoverageComplete !== 'boolean'
    || typeof value.ScalarDefined !== 'boolean' || !text(value.Code)) return false
  if (!value.Complete) return !value.ScalarDefined && value.IncludedRows === null
    && (value.CoverageComplete ? value.Code === 'inventory_resource_unavailable' : value.Code === 'inventory_relation_incomplete')
  return value.CoverageComplete && count(value.IncludedRows)
    && (value.ScalarDefined ? value.Code === (value.IncludedRows === 0 ? 'complete_empty' : 'available') : value.Code === 'average_balance_zero' && value.IncludedRows > 0)
}
function proof(value: unknown, inputs: InventoryTurnoverReport['Inputs']): value is InventoryTurnoverProof {
  if (!record(value) || !hash(value.InputWitnessSha256) || value.SnapshotVerified !== true
    || typeof value.CurrentCompletePublication !== 'boolean' || typeof value.PreviousCompletePublication !== 'boolean'
    || typeof value.ComparisonSourceIdentityCompatible !== 'boolean'
    || !['Compatible', 'Conflict', 'Unverified'].includes(String(value.ComparisonIdentityStatus))) return false
  if (value.ComparisonSourceIdentityCompatible !== (value.ComparisonIdentityStatus === 'Compatible')) return false
  if (inputs.Current.Complete && !value.CurrentCompletePublication || inputs.Previous.Complete && !value.PreviousCompletePublication) return false
  return value.ComparisonIdentityStatus === 'Unverified' ? !inputs.Current.Complete || !inputs.Previous.Complete
    : value.CurrentCompletePublication && value.PreviousCompletePublication
}
function utc(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 23) === value.slice(0, 23) }
function envelope(value: unknown, request: InventoryTurnoverRequest): value is InventoryTurnoverReport {
  if (!record(request) || request.Version !== 1 || !identity(request.SourceIdentity) || inventoryTurnoverMonthError(request.Month)) return false
  const windows = inventoryTurnoverWindows(request.Month)
  return record(value) && value.Version === request.Version && sameIdentity(value.SourceIdentity, request.SourceIdentity) && value.Month === request.Month
    && basis(value) && value.PresentationBasis === 'CurrentGbaClrDecimal' && columns(value.Columns) && units(value.ResourceUnits)
    && record(value.CurrentPeriod) && record(value.PreviousPeriod)
    && value.CurrentPeriod.From === windows.CurrentPeriod.From && value.CurrentPeriod.ThroughExclusive === windows.CurrentPeriod.ThroughExclusive
    && value.PreviousPeriod.From === windows.PreviousPeriod.From && value.PreviousPeriod.ThroughExclusive === windows.PreviousPeriod.ThroughExclusive
    && record(value.Inputs) && input(value.Inputs.Current) && input(value.Inputs.Previous) && cells(value.Cells)
    && typeof value.Complete === 'boolean' && typeof value.HasRows === 'boolean' && text(value.Code)
    && (value.AvailabilityMessage === null || text(value.AvailabilityMessage))
    && utc(value.ObservationStartedAtUtc) && utc(value.ObservationCompletedAtUtc) && value.ObservationStartedAtUtc <= value.ObservationCompletedAtUtc
    && hash(value.RequestSha256) && hash(value.ResultSha256) && isManagementReturnsDocumentUrl(value.DocumentURL) && isManagementReturnsDocumentUrl(value.PdfDocumentURL)
}
function scalarAvailability(report: InventoryTurnoverReport): boolean {
  return [report.Inputs.Current, report.Inputs.Previous].every((input, index) => {
    const cell = report.Cells[index]
    if (!input.Complete || !input.ScalarDefined) return !cell.Available && cell.ExactValue === null
    if (input.IncludedRows === 0) return cell.Available && cell.Value === null
    return cell.Available || cell.ExactValue !== null
  })
}
/** Only checks binding/availability. All financial strings, ratios and changes are supplied by the server. */
export function normalizeInventoryTurnoverReport(value: unknown, request: InventoryTurnoverRequest): InventoryTurnoverReport {
  if (!envelope(value, request) || !proof(value.Proof, value.Inputs) || !scalarAvailability(value)) throw invalidInventoryTurnover()
  const current = value.Inputs.Current, previous = value.Inputs.Previous
  const hasRows = [current, previous].some(input => input.IncludedRows !== null && input.IncludedRows > 0)
  if (value.Complete !== (current.Complete && previous.Complete) || value.HasRows !== hasRows
    || !value.Complete && value.Cells[3].Available || !previous.ScalarDefined && value.Cells[2].Available) throw invalidInventoryTurnover()
  let expected: string
  if (value.Proof.ComparisonIdentityStatus === 'Conflict') {
    if (value.Cells.slice(2).some(cell => cell.Available || cell.ExactValue !== null)) throw invalidInventoryTurnover()
    expected = 'asset_source_identity_conflict_between_periods'
  } else expected = !value.Complete ? 'inventory_input_unavailable' : !current.ScalarDefined || !previous.ScalarDefined ? 'average_balance_zero'
    : value.Cells.some(cell => !cell.Available) ? 'decimal_projection_unavailable' : !hasRows ? 'complete_empty' : 'available'
  const noticeRequired = !value.Complete || expected === 'asset_source_identity_conflict_between_periods' || value.Cells.some(cell => !cell.Available) || !hasRows
  if (value.Code !== expected || noticeRequired !== (value.AvailabilityMessage !== null)) throw invalidInventoryTurnover()
  return value
}
export function invalidInventoryTurnover() { return new Error('Сервер повернув непідтверджений результат оборачуваності запасів або інший місяць.') }
