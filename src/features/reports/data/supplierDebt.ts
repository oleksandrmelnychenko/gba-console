import type { ReportCatalogueEntry } from '../types'

export const SUPPLIER_DEBT_SOURCE = { World: 'fenix', SourceId: '0xb4b500055d78a52511ddfe73b936bfa6',
  DefinitionSha256: '1ba1cbbf4a770f5ff2752de3728c92db599578bb35d77135847aee87193feaa8' } as const
export const SUPPLIER_DEBT_NAME = 'Задолженность перед поставщиками'
export const SUPPLIER_DEBT_INPUT_BASIS = 'CurrentOurCompleteDatedManagementBalances'
export const SUPPLIER_DEBT_PRESENTATION_BASIS = 'CurrentGbaClrDecimal'
export const SUPPLIER_DEBT_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: 2 },
] as const
export type SupplierDebtCapabilities = {
  Version: 1; SourceIdentity: typeof SUPPLIER_DEBT_SOURCE; ReportName: typeof SUPPLIER_DEBT_NAME
  ScopeKind: 'TwoExplicitCurrentGbaCalendarMonths'; InputBasis: typeof SUPPLIER_DEBT_INPUT_BASIS
  PresentationBasis: typeof SUPPLIER_DEBT_PRESENTATION_BASIS; Columns: Array<typeof SUPPLIER_DEBT_COLUMNS[number]>
  RuntimeImplemented: boolean; RequiresCompleteNormalPublications: true; InputAvailability: 'CheckedByPreview'
  SourceParityVerified: false; EffectiveSourcePeriodsVerified: false
}
export type SupplierDebtRequest = { Version: 1; SourceIdentity: typeof SUPPLIER_DEBT_SOURCE; Month: string }
export type SupplierDebtExactNumber = { Numerator: string; Denominator: string }
export type SupplierDebtInput = {
  Available: boolean; PublicationId: string | null; ThroughExclusive: string; DatedOpeningComplete: boolean; MovementPrefixComplete: boolean
  BalanceGrainRows: number; IncludedGrainRows: number; UnknownKindGrains: number; InvalidGrains: number; Code: string
  ManagementBalanceSum: SupplierDebtExactNumber | null
}
export type SupplierDebtProof = {
  OpeningRunId: string | null; OpeningPassSha256: string | null; BusinessBoundary: string | null; SourceIdentitySha256: string | null
  MovementGenerations: Array<{ BusinessMonth: string; RunId: string; PassSha256: string }>; InputProofSha256: string; OurSnapshotVerified: true
}
export type SupplierDebtReport = {
  Version: 1; SourceIdentity: typeof SUPPLIER_DEBT_SOURCE; Month: string
  CurrentPeriod: { From: string; ThroughExclusive: string }; PreviousPeriod: { From: string; ThroughExclusive: string }
  Columns: Array<typeof SUPPLIER_DEBT_COLUMNS[number]>
  Cells: Array<{ Key: typeof SUPPLIER_DEBT_COLUMNS[number]['Key']; Value: string | null; Available: boolean; ExactValue: SupplierDebtExactNumber | null; FormattedValue: string | null }>
  Inputs: { Current: SupplierDebtInput; Previous: SupplierDebtInput }; Complete: boolean; HasRows: boolean
  Code: 'available' | 'published_empty' | 'input_not_available' | 'decimal_projection_unavailable'
  InputBasis: typeof SUPPLIER_DEBT_INPUT_BASIS; PresentationBasis: typeof SUPPLIER_DEBT_PRESENTATION_BASIS
  Proof: SupplierDebtProof; SourceParityVerified: false; EffectiveSourcePeriodsVerified: false
  RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const guid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
function date(value: unknown): value is string {
  if (typeof value !== 'string' || value < '0001-01-01' || !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}
function identity(value: unknown): boolean { return record(value) && Object.entries(SUPPLIER_DEBT_SOURCE).every(([key, expected]) => value[key] === expected) }
function columns(value: unknown): boolean { return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
  && Object.entries(SUPPLIER_DEBT_COLUMNS[index]).every(([key, expected]) => column[key] === expected)) }
function basis(value: Record<string, unknown>): boolean { return value.InputBasis === SUPPLIER_DEBT_INPUT_BASIS
  && value.PresentationBasis === SUPPLIER_DEBT_PRESENTATION_BASIS && value.SourceParityVerified === false && value.EffectiveSourcePeriodsVerified === false }
export function isSupplierDebtCatalogueEntry(report: ReportCatalogueEntry): boolean {
  const matches = report.Sources.filter(source => source.World === SUPPLIER_DEBT_SOURCE.World && source.SourceId === SUPPLIER_DEBT_SOURCE.SourceId)
  return report.Id === `custom:fenix:${SUPPLIER_DEBT_SOURCE.SourceId}` && matches.length === 1
    && (matches[0].DefinitionSha256 === null || matches[0].DefinitionSha256 === SUPPLIER_DEBT_SOURCE.DefinitionSha256)
}
export function isSupplierDebtCapabilities(value: unknown): value is SupplierDebtCapabilities {
  return record(value) && value.Version === 1 && identity(value.SourceIdentity) && value.ReportName === SUPPLIER_DEBT_NAME
    && value.ScopeKind === 'TwoExplicitCurrentGbaCalendarMonths' && columns(value.Columns) && basis(value)
    && typeof value.RuntimeImplemented === 'boolean' && value.RequiresCompleteNormalPublications === true && value.InputAvailability === 'CheckedByPreview'
}
export function supplierDebtMonthError(month: string): string | null {
  return !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month <= '0001-01' || month >= '7999-12'
    ? 'Оберіть допустимий місяць із поточним і попереднім періодами.' : null
}
export function supplierDebtPeriods(month: string): Pick<SupplierDebtReport, 'CurrentPeriod' | 'PreviousPeriod'> {
  if (supplierDebtMonthError(month)) throw new Error('Некоректний місячний період заборгованості.')
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5))
  const shifted = (offset: number) => { const index = year * 12 + number - 1 + offset
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01` }
  return { CurrentPeriod: { From: shifted(0), ThroughExclusive: shifted(1) }, PreviousPeriod: { From: shifted(-1), ThroughExclusive: shifted(0) } }
}
export function createSupplierDebtRequest(capability: SupplierDebtCapabilities, month: string): SupplierDebtRequest {
  if (!isSupplierDebtCapabilities(capability) || !capability.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = supplierDebtMonthError(month); if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...SUPPLIER_DEBT_SOURCE }, Month: month }
}
function exact(value: unknown): value is SupplierDebtExactNumber {
  return record(value) && typeof value.Numerator === 'string' && typeof value.Denominator === 'string'
    && value.Numerator.length <= 20000 && value.Denominator.length <= 20000
    && /^(?:0|-?[1-9]\d*)$/.test(value.Numerator) && /^[1-9]\d*$/.test(value.Denominator)
    && (value.Numerator !== '0' || value.Denominator === '1')
}
function input(value: unknown, endpoint: string): value is SupplierDebtInput {
  if (!record(value) || typeof value.Available !== 'boolean' || value.ThroughExclusive !== endpoint
    || typeof value.DatedOpeningComplete !== 'boolean' || typeof value.MovementPrefixComplete !== 'boolean'
    || !(value.PublicationId === null || guid(value.PublicationId)) || typeof value.Code !== 'string' || !value.Code.trim()
    || ![value.BalanceGrainRows, value.IncludedGrainRows, value.UnknownKindGrains, value.InvalidGrains].every(count)
    || (value.IncludedGrainRows as number) > (value.BalanceGrainRows as number)
    || (value.UnknownKindGrains as number) > (value.BalanceGrainRows as number) || (value.InvalidGrains as number) > (value.BalanceGrainRows as number)) return false
  if (!value.Available) return value.IncludedGrainRows === 0 && value.ManagementBalanceSum === null
  return guid(value.PublicationId) && value.DatedOpeningComplete && value.MovementPrefixComplete
    && value.UnknownKindGrains === 0 && value.InvalidGrains === 0
    && (value.IncludedGrainRows === 0 ? value.ManagementBalanceSum === null : exact(value.ManagementBalanceSum))
}
function cells(value: unknown): boolean {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== SUPPLIER_DEBT_COLUMNS[index].Key || typeof cell.Available !== 'boolean'
      || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.ExactValue === null && cell.FormattedValue === null
    return exact(cell.ExactValue) && decimal(cell.Value) && decimal(cell.FormattedValue) && (index < 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function proof(value: unknown, report: SupplierDebtReport): value is SupplierDebtProof {
  if (!record(value) || value.OurSnapshotVerified !== true || !hash(value.InputProofSha256)
    || !(value.OpeningRunId === null || guid(value.OpeningRunId)) || !(value.OpeningPassSha256 === null || hash(value.OpeningPassSha256))
    || !(value.BusinessBoundary === null || date(value.BusinessBoundary)) || !(value.SourceIdentitySha256 === null || hash(value.SourceIdentitySha256))
    || !Array.isArray(value.MovementGenerations)) return false
  const opening = report.Inputs.Current.DatedOpeningComplete || report.Inputs.Previous.DatedOpeningComplete
  if (opening && (!guid(value.OpeningRunId) || !hash(value.OpeningPassSha256) || !date(value.BusinessBoundary)
    || value.BusinessBoundary > report.PreviousPeriod.ThroughExclusive || !hash(value.SourceIdentitySha256))) return false
  const generations = value.MovementGenerations
  if (new Set(generations.map(item => record(item) ? item.RunId : null)).size !== generations.length) return false
  for (const [index, item] of generations.entries()) {
    if (!record(item) || !guid(item.RunId) || !hash(item.PassSha256) || !date(item.BusinessMonth) || !item.BusinessMonth.endsWith('-01')
      || item.BusinessMonth >= report.CurrentPeriod.ThroughExclusive) return false
    if (index > 0 && supplierDebtPeriods(item.BusinessMonth.slice(0, 7)).PreviousPeriod.From !== (generations[index - 1] as { BusinessMonth: string }).BusinessMonth) return false
  }
  if (generations.length && (!opening || !date(value.BusinessBoundary) || (generations[0] as { BusinessMonth: string }).BusinessMonth !== `${value.BusinessBoundary.slice(0, 7)}-01`)) return false
  return !report.Complete || (report.Inputs.Current.PublicationId === value.OpeningRunId && report.Inputs.Previous.PublicationId === value.OpeningRunId
    && opening && generations.length > 0 && (generations.at(-1) as { BusinessMonth: string }).BusinessMonth === report.PreviousPeriod.ThroughExclusive)
}
/** Request scope and coverage only: no balances, ratios or currency conversions are calculated in the browser. */
export function normalizeSupplierDebtReport(value: unknown, request: SupplierDebtRequest): SupplierDebtReport {
  const periods = supplierDebtPeriods(request.Month)
  if (!record(value) || value.Version !== 1 || !identity(value.SourceIdentity) || value.Month !== request.Month || !columns(value.Columns) || !basis(value)
    || !record(value.CurrentPeriod) || !record(value.PreviousPeriod)
    || !Object.entries(periods.CurrentPeriod).every(([key, expected]) => (value.CurrentPeriod as Record<string, unknown>)[key] === expected)
    || !Object.entries(periods.PreviousPeriod).every(([key, expected]) => (value.PreviousPeriod as Record<string, unknown>)[key] === expected)
    || !record(value.Inputs) || !input(value.Inputs.Current, periods.CurrentPeriod.ThroughExclusive) || !input(value.Inputs.Previous, periods.PreviousPeriod.ThroughExclusive)
    || !cells(value.Cells) || typeof value.Complete !== 'boolean' || typeof value.HasRows !== 'boolean'
    || !hash(value.RequestSha256) || !hash(value.ResultSha256) || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string') throw invalid()
  const report = value as unknown as SupplierDebtReport, current = report.Inputs.Current, previous = report.Inputs.Previous
  if (report.Complete !== (current.Available && previous.Available) || report.HasRows !== (current.IncludedGrainRows > 0 || previous.IncludedGrainRows > 0)
    || !proof(value.Proof, report)) throw invalid()
  for (const [index, period] of [current, previous].entries()) {
    const cell = report.Cells[index]
    if (!(cell.ExactValue === null ? period.ManagementBalanceSum === null
      : period.ManagementBalanceSum !== null && cell.ExactValue.Numerator === period.ManagementBalanceSum.Numerator
        && cell.ExactValue.Denominator === period.ManagementBalanceSum.Denominator)
      || cell.Available !== (period.Available && (cell.ExactValue === null || cell.Value !== null))) throw invalid()
  }
  const expected = !report.Complete ? 'input_not_available' : !report.HasRows ? 'published_empty'
    : report.Cells.some(cell => !cell.Available) ? 'decimal_projection_unavailable' : 'available'
  if (report.Code !== expected) throw invalid()
  return report
}
function invalid() { return new Error('Сервер повернув некоректний результат заборгованості або інший місячний період.') }
