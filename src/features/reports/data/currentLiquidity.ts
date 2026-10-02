import { isManagementReturnsDocumentUrl } from './managementReturns'
import type { ReportCatalogueEntry } from '../types'

// Catalogue selection only. Requests copy the actual version and opaque definition from the server capability.
export const CURRENT_LIQUIDITY_CATALOGUE_SOURCE = { World: 'fenix', SourceId: '0xa6b50007e90a504c11de09818f4a9360' } as const
export const CURRENT_LIQUIDITY_ROUTE = '/report/constructors/current-liquidity'
export const CURRENT_LIQUIDITY_NAME = 'Коэффициент текущей ликвидности'
export const CURRENT_LIQUIDITY_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
export const CURRENT_LIQUIDITY_UNITS = [
  { Relation: 'Cash', SourceCaption: 'СуммаУпр', SourceUnitAnnotation: '(Упр)' },
  { Relation: 'Settlements', SourceCaption: 'СуммаУпр', SourceUnitAnnotation: '(Упр)' },
  { Relation: 'Warehouse', SourceCaption: 'Стоимость', SourceUnitAnnotation: '(Упр)' },
  { Relation: 'RetailNtt', SourceCaption: 'Сумма', SourceUnitAnnotation: '(грн)' },
  { Relation: 'WorkInProgress', SourceCaption: 'Стоимость', SourceUnitAnnotation: '(Упр)' },
  { Relation: 'TransferredGoods', SourceCaption: 'Стоимость', SourceUnitAnnotation: '(Упр)' },
] as const
export const CURRENT_LIQUIDITY_BASIS = { InputBasis: 'CurrentOurSyncedBalances', ResultUnit: 'DimensionlessRatio',
  EffectiveSourcePeriodsVerified: false, SourceParityVerified: false, NativeVirtualTableZeroSuppressionVerified: false, AppliesFxConversion: false } as const
export type CurrentLiquidityIdentity = { World: string; SourceId: string; DefinitionSha256: string }
export type CurrentLiquidityEndpoints = { CurrentEndpoint: string; PreviousEndpoint: string }
export type CurrentLiquidityCapabilities = typeof CURRENT_LIQUIDITY_BASIS & {
  Version: 1; SourceIdentity: CurrentLiquidityIdentity; ReportName: typeof CURRENT_LIQUIDITY_NAME
  ScopeKind: 'CurrentGbaBalanceEndpoints'; Grouping: 'Scalar'; Filters: ['CurrentEndpoint', 'PreviousEndpoint']
  Columns: Array<typeof CURRENT_LIQUIDITY_COLUMNS[number]>; ResourceUnits: Array<typeof CURRENT_LIQUIDITY_UNITS[number]>
  RuntimeImplemented: boolean; RequiresCompleteNormalPublications: true; InputAvailability: 'CheckedByPreview'
}
export type CurrentLiquidityRequest = CurrentLiquidityEndpoints & { Version: 1; SourceIdentity: CurrentLiquidityIdentity }
export type CurrentLiquidityCell = { Key: typeof CURRENT_LIQUIDITY_COLUMNS[number]['Key']; Value: string | null; Available: boolean
  ExactValue: { Numerator: string; Denominator: string } | null; FormattedValue: string | null }
export type CurrentLiquidityInput = { Available: boolean; CoverageComplete: boolean; IncludedUnionRows: number | null; Code: string }
export const CURRENT_LIQUIDITY_RELATIONS = ['CashBalances', 'WarehouseBalances', 'NttBalances', 'WorkInProgress', 'TransferredGoods', 'CounterpartyManagement'] as const
export type CurrentLiquidityRelationProof = { Relation: typeof CURRENT_LIQUIDITY_RELATIONS[number]; Available: boolean; CompletePublication: boolean
  Code: string; DatedOpeningVerified: boolean; CompletedMovementMonths: number }
export type CurrentLiquidityEndpointProof = { CompletePublication: boolean; WarehouseStatusMappingAvailable: boolean
  SettlementMovementSourceIdentityVerified: boolean; Relations: CurrentLiquidityRelationProof[] }
export type CurrentLiquidityProof = { InputWitnessSha256: string; SnapshotVerified: true; Current: CurrentLiquidityEndpointProof
  Previous: CurrentLiquidityEndpointProof; ComparisonIdentityStatus: 'Compatible' | 'Conflict' | 'Unverified'; ComparisonSourceIdentityCompatible: boolean }
export type CurrentLiquidityReport = typeof CURRENT_LIQUIDITY_BASIS & CurrentLiquidityEndpoints & {
  Version: 1; SourceIdentity: CurrentLiquidityIdentity; Columns: Array<typeof CURRENT_LIQUIDITY_COLUMNS[number]>
  ResourceUnits: Array<typeof CURRENT_LIQUIDITY_UNITS[number]>; Cells: CurrentLiquidityCell[]
  Inputs: { Current: CurrentLiquidityInput; Previous: CurrentLiquidityInput }; Complete: boolean; HasRows: boolean; Code: string
  AvailabilityMessage: string | null; PresentationBasis: 'CurrentGbaClrDecimal'; Proof: CurrentLiquidityProof
  ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string; RequestSha256: string; ResultSha256: string
  DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1024 && value === value.trim()
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 200000
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
function identity(value: unknown): value is CurrentLiquidityIdentity {
  return record(value) && Object.keys(value).length === 3 && text(value.World)
    && typeof value.SourceId === 'string' && /^0x[0-9a-f]{32}$/.test(value.SourceId) && hash(value.DefinitionSha256)
}
function sameIdentity(value: unknown, expected: CurrentLiquidityIdentity): boolean {
  return identity(value) && value.World === expected.World && value.SourceId === expected.SourceId && value.DefinitionSha256 === expected.DefinitionSha256
}
function columns(value: unknown): boolean { return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(CURRENT_LIQUIDITY_COLUMNS[index]).every(([key, expected]) => column[key] === expected)) }
function units(value: unknown): boolean { return Array.isArray(value) && value.length === 6 && value.every((unit, index) => record(unit)
  && Object.entries(CURRENT_LIQUIDITY_UNITS[index]).every(([key, expected]) => unit[key] === expected)) }
function basis(value: Record<string, unknown>): boolean { return Object.entries(CURRENT_LIQUIDITY_BASIS).every(([key, expected]) => value[key] === expected) }
export function isCurrentLiquidityCatalogueEntry(report: ReportCatalogueEntry): boolean {
  const sources = report.Sources.filter(source => source.World === CURRENT_LIQUIDITY_CATALOGUE_SOURCE.World && source.SourceId === CURRENT_LIQUIDITY_CATALOGUE_SOURCE.SourceId)
  return report.Id === `custom:fenix:${CURRENT_LIQUIDITY_CATALOGUE_SOURCE.SourceId}` && sources.length === 1
    && (sources[0].DefinitionSha256 === null || hash(sources[0].DefinitionSha256))
}
export function currentLiquidityCatalogueMatches(report: ReportCatalogueEntry, capability: CurrentLiquidityCapabilities): boolean {
  if (!isCurrentLiquidityCatalogueEntry(report) || !isCurrentLiquidityCapabilities(capability)) return false
  const source = report.Sources.find(source => source.World === capability.SourceIdentity.World && source.SourceId === capability.SourceIdentity.SourceId)
  return Boolean(source && (source.DefinitionSha256 === null || source.DefinitionSha256 === capability.SourceIdentity.DefinitionSha256))
}
export function isCurrentLiquidityCapabilities(value: unknown): value is CurrentLiquidityCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity)
    && value.SourceIdentity.World === CURRENT_LIQUIDITY_CATALOGUE_SOURCE.World && value.SourceIdentity.SourceId === CURRENT_LIQUIDITY_CATALOGUE_SOURCE.SourceId
    && value.ReportName === CURRENT_LIQUIDITY_NAME && value.ScopeKind === 'CurrentGbaBalanceEndpoints'
    && value.Grouping === 'Scalar' && basis(value) && columns(value.Columns) && units(value.ResourceUnits)
    && Array.isArray(value.Filters) && value.Filters.length === 2 && value.Filters[0] === 'CurrentEndpoint' && value.Filters[1] === 'PreviousEndpoint'
    && typeof value.RuntimeImplemented === 'boolean' && value.RequiresCompleteNormalPublications === true && value.InputAvailability === 'CheckedByPreview'
}
const endpoint = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])-01$/.test(value) && value > '0001-01-01' && value < '3999-01-01'
/** Calendar checks only; endpoints are explicit GBA choices, not inferred native settings. */
export function currentLiquidityEndpointError(current: string, previous: string): string | null {
  return !endpoint(current) || !endpoint(previous) || previous >= current ? 'Оберіть дві допустимі дати першого дня місяця, попередню раніше поточної.' : null
}
export function currentLiquidityDefaultEndpoints(today: string): CurrentLiquidityEndpoints {
  const current = `${today.slice(0, 7)}-01`
  if (!endpoint(current)) return { CurrentEndpoint: '', PreviousEndpoint: '' }
  const index = Number(current.slice(0, 4)) * 12 + Number(current.slice(5, 7)) - 2
  return { CurrentEndpoint: current, PreviousEndpoint: `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01` }
}
export function createCurrentLiquidityRequest(capability: CurrentLiquidityCapabilities, current: string, previous: string): CurrentLiquidityRequest {
  if (!isCurrentLiquidityCapabilities(capability) || !capability.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = currentLiquidityEndpointError(current, previous); if (error) throw new Error(error)
  return { Version: capability.Version, SourceIdentity: { ...capability.SourceIdentity }, CurrentEndpoint: current, PreviousEndpoint: previous }
}
function exact(value: unknown): boolean { return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
  && value.Numerator.length <= 20000 && value.Denominator.length <= 20000 && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator)
  && /^[1-9]\d*$/.test(value.Denominator) && (value.Numerator !== '0' || value.Denominator === '1') }
function cells(value: unknown): value is CurrentLiquidityCell[] {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== CURRENT_LIQUIDITY_COLUMNS[index].Key || typeof cell.Available !== 'boolean'
      || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.ExactValue === null && cell.FormattedValue === null
    return exact(cell.ExactValue) && decimal(cell.Value) && decimal(cell.FormattedValue) && (index !== 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function input(value: unknown): value is CurrentLiquidityInput {
  if (!record(value) || typeof value.Available !== 'boolean' || typeof value.CoverageComplete !== 'boolean' || !text(value.Code)) return false
  if (value.Available) return value.CoverageComplete && count(value.IncludedUnionRows)
    && value.Code === (value.IncludedUnionRows === 0 ? 'complete_empty' : 'available')
  return value.IncludedUnionRows === null && (value.CoverageComplete
    ? ['warehouse_status_conflict', 'warehouse_status_unavailable', 'balance_resource_unavailable'].includes(value.Code) : value.Code === 'balance_relation_incomplete')
}
function relation(value: unknown, index: number): value is CurrentLiquidityRelationProof {
  return record(value) && value.Relation === CURRENT_LIQUIDITY_RELATIONS[index] && typeof value.Available === 'boolean'
    && typeof value.CompletePublication === 'boolean' && text(value.Code) && typeof value.DatedOpeningVerified === 'boolean'
    && count(value.CompletedMovementMonths) && value.CompletedMovementMonths <= 120
    && (!value.Available || value.CompletePublication) && (!value.CompletePublication || value.DatedOpeningVerified)
    && (value.DatedOpeningVerified || value.CompletedMovementMonths === 0)
}
function endpointProof(value: unknown, supplied: CurrentLiquidityInput): value is CurrentLiquidityEndpointProof {
  if (!record(value) || typeof value.CompletePublication !== 'boolean' || typeof value.WarehouseStatusMappingAvailable !== 'boolean'
    || typeof value.SettlementMovementSourceIdentityVerified !== 'boolean' || !Array.isArray(value.Relations) || value.Relations.length !== 6
    || !value.Relations.every(relation)) return false
  const relations = value.Relations as CurrentLiquidityRelationProof[]
  return value.CompletePublication === relations.every(item => item.CompletePublication)
    && supplied.CoverageComplete === relations.every(item => item.Available)
    && (!value.WarehouseStatusMappingAvailable || relations[1].Available)
    && value.SettlementMovementSourceIdentityVerified === (relations[5].Available && relations[5].CompletedMovementMonths === 0)
}
function proof(value: unknown, inputs: CurrentLiquidityReport['Inputs']): value is CurrentLiquidityProof {
  if (!record(value) || !hash(value.InputWitnessSha256) || value.SnapshotVerified !== true || !endpointProof(value.Current, inputs.Current)
    || !endpointProof(value.Previous, inputs.Previous) || typeof value.ComparisonSourceIdentityCompatible !== 'boolean'
    || !['Compatible', 'Conflict', 'Unverified'].includes(String(value.ComparisonIdentityStatus))) return false
  return value.ComparisonSourceIdentityCompatible === (value.ComparisonIdentityStatus === 'Compatible')
    && (value.ComparisonIdentityStatus === 'Unverified' ? !inputs.Current.Available || !inputs.Previous.Available : inputs.Current.Available && inputs.Previous.Available)
}
function utc(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 23) === value.slice(0, 23) }
function envelope(value: unknown, request: CurrentLiquidityRequest): value is CurrentLiquidityReport {
  return record(request) && request.Version === 1 && identity(request.SourceIdentity) && !currentLiquidityEndpointError(request.CurrentEndpoint, request.PreviousEndpoint)
    && record(value) && value.Version === request.Version && sameIdentity(value.SourceIdentity, request.SourceIdentity)
    && value.CurrentEndpoint === request.CurrentEndpoint && value.PreviousEndpoint === request.PreviousEndpoint
    && basis(value) && value.PresentationBasis === 'CurrentGbaClrDecimal' && columns(value.Columns) && units(value.ResourceUnits)
    && record(value.Inputs) && input(value.Inputs.Current) && input(value.Inputs.Previous) && cells(value.Cells)
    && typeof value.Complete === 'boolean' && typeof value.HasRows === 'boolean' && text(value.Code)
    && (value.AvailabilityMessage === null || text(value.AvailabilityMessage))
    && utc(value.ObservationStartedAtUtc) && utc(value.ObservationCompletedAtUtc) && value.ObservationStartedAtUtc <= value.ObservationCompletedAtUtc
    && hash(value.RequestSha256) && hash(value.ResultSha256) && isManagementReturnsDocumentUrl(value.DocumentURL) && isManagementReturnsDocumentUrl(value.PdfDocumentURL)
}
function scalarAvailability(report: CurrentLiquidityReport): boolean {
  return [report.Inputs.Current, report.Inputs.Previous].every((supplied, index) => {
    const cell = report.Cells[index]
    if (!supplied.Available) return !cell.Available && cell.ExactValue === null
    if (supplied.IncludedUnionRows === 0) return cell.Available && cell.Value === null
    return cell.Available || cell.ExactValue !== null
  })
}
/** Validates scope, delivery and independent availability; never calculates financial values. */
export function normalizeCurrentLiquidityReport(value: unknown, request: CurrentLiquidityRequest): CurrentLiquidityReport {
  if (!envelope(value, request) || !proof(value.Proof, value.Inputs) || !scalarAvailability(value)) throw invalidCurrentLiquidity()
  const current = value.Inputs.Current, previous = value.Inputs.Previous
  const hasRows = [current, previous].some(supplied => supplied.IncludedUnionRows !== null && supplied.IncludedUnionRows > 0)
  if (value.Complete !== (current.Available && previous.Available) || value.HasRows !== hasRows
    || !value.Complete && value.Cells[3].Available || !previous.Available && value.Cells[2].Available) throw invalidCurrentLiquidity()
  const conflict = value.Proof.ComparisonIdentityStatus === 'Conflict'
  if (conflict && value.Cells.slice(2).some(cell => cell.Available || cell.ExactValue !== null)) throw invalidCurrentLiquidity()
  const expected = conflict ? 'liquidity_source_identity_conflict_between_endpoints' : !value.Complete ? 'balance_input_unavailable'
    : value.Cells.some(cell => !cell.Available) ? 'decimal_projection_unavailable' : !hasRows ? 'complete_empty' : 'available'
  if (value.Code !== expected || (!value.Complete || conflict || value.Cells.some(cell => !cell.Available) || !hasRows) !== (value.AvailabilityMessage !== null)) throw invalidCurrentLiquidity()
  return value
}
export function invalidCurrentLiquidity() { return new Error('Сервер повернув непідтверджений результат ліквідності або інші дати.') }
