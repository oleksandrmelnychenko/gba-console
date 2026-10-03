import { isManagementReturnsDocumentUrl } from './managementReturns'
import type { ReportCatalogueEntry } from '../types'

// Catalogue selectors only. Definition bytes and version always come from the actual server capability.
export const PLANNED_CASH_FORMS = {
  DdsPayouts: { SourceId: '0xb4b500055d78a52511ddfdb9b66af561', Route: 'dds-payouts', ReportName: 'Выплаты ДС план-факт (по Плану ДДС)', Grouping: 'Контрагент', Periodicity: 'Месяц', Scenario: 'Сценарий_План', Endpoint: null },
  CalendarPayouts: { SourceId: '0xb4b500055d78a52511ddfdb9b66af55f', Route: 'calendar-payouts', ReportName: 'Выплаты ДС план-факт (по платежному календарю)', Grouping: 'Контрагент', Periodicity: 'Месяц', Scenario: null, Endpoint: 'КонецПланируемогоПериода' },
  NetFlow: { SourceId: '0xa6b50007e90a504c11de0a2e1aa15dad', Route: 'net-flow', ReportName: 'Планируемый чистый денежный поток', Grouping: 'Контрагент', Periodicity: 'Месяц', Scenario: null, Endpoint: 'КонецПериодаПлан' },
  DdsReceipts: { SourceId: '0xb4b500055d78a52511ddfcbfb8c6626c', Route: 'dds-receipts', ReportName: 'Поступления ДС план-факт (по Плану ДДС)', Grouping: 'СтатьяДвиженияДенежныхСредств', Periodicity: 'Месяц', Scenario: 'Сценарий', Endpoint: null },
  CalendarReceipts: { SourceId: '0xb4b500055d78a52511ddfcbfb8c66262', Route: 'calendar-receipts', ReportName: 'Поступления ДС план-факт (по платежному календарю)', Grouping: 'Контрагент', Periodicity: 'Квартал', Scenario: null, Endpoint: 'КонецПланируемогоПериода' },
} as const
export type PlannedCashKind = keyof typeof PLANNED_CASH_FORMS
export const PLANNED_CASH_ROUTE = '/report/constructors/planned-cash'
export const PLANNED_CASH_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
  { Key: 'ЗначениеПлан', Caption: 'План', DecimalPlaces: null },
  { Key: 'UserFields.field4', Caption: '% Выполнения', DecimalPlaces: 2 },
  { Key: 'UserFields.field5', Caption: 'Отклонение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field3', Caption: 'Отклонение (абс)', DecimalPlaces: null },
] as const
export const PLANNED_CASH_UNITS = [
  { Relation: 'Fact', ResourceCaption: 'Управлінська сума', UnitAnnotation: '(Упр)', UsedByDefault: true },
  { Relation: 'Plan', ResourceCaption: 'Управлінська сума', UnitAnnotation: '(Упр)', UsedByDefault: true },
  { Relation: 'Account', ResourceCaption: 'Сума у валюті рахунку', UnitAnnotation: 'Сумма в валюте денежных средств', UsedByDefault: false },
  { Relation: 'Settlement', ResourceCaption: 'Сума взаєморозрахунків', UnitAnnotation: 'Сумма в валюте взаиморасчетов', UsedByDefault: false },
] as const
const basis = { InputBasis: 'CurrentOurSyncedCashAndPlans', EffectiveSourcePeriodsVerified: false, SourceParityVerified: false,
  NativeVirtualTableZeroSuppressionVerified: false, AppliesFxConversion: false, NativeSavedVariantsSupported: false } as const
export type PlannedCashIdentity = { World: string; SourceId: string; DefinitionSha256: string }
export type PlannedCashColumn = { Key: string; Caption: string; DecimalPlaces: number | null }
export type PlannedCashCapabilities = typeof basis & {
  Version: 1; SourceIdentity: PlannedCashIdentity; Kind: PlannedCashKind; ReportName: string; Grouping: string
  ScopeKind: 'ExplicitCurrentOurIntervalsAndPlan'; Filters: string[]; Columns: PlannedCashColumn[]; ResourceUnits: Array<typeof PLANNED_CASH_UNITS[number]>
  NativeScenarioParameterName: string | null; NativePlanEndpointParameterName: string | null; SourceEmbeddedPeriodicity: string
  RuntimeImplemented: boolean; RequiresCompleteNormalPublications: true; InputAvailability: 'CheckedByPreview'
  RequiresObservedScenario: boolean; ScenarioSelectionLabelsAvailable: false
  ScenarioChoiceAvailability: 'CheckedByChoices' | 'NotApplicable'; ScenarioChoiceApiImplemented: boolean; NativeChoiceVisibilityVerified: false; GroupLabelAvailability: 'CheckedByPreview'; UnsupportedFilters: string[]
}
export type PlannedCashPeriod = { From: string; ThroughExclusive: string }
export type PlannedCashFilters = { From: string; ThroughExclusive: string; PreviousFrom: string; PreviousThroughExclusive: string; PlanEndpoint: string }
export type PlannedCashRequest = { Version: 1; SourceIdentity: PlannedCashIdentity; CurrentPeriod: PlannedCashPeriod; PreviousPeriod: PlannedCashPeriod | null
  PlanEndpoint: string | null; Scenario: null; ScenarioChoiceKey?: string | null }
export type PlannedCashCell = { Key: string; Value: string | null; Available: boolean; ExactValue: { Numerator: string; Denominator: string } | null; FormattedValue: string | null }
export type PlannedCashGroup = { Key: string; GroupIsNull: boolean; Name: string | null; NameAvailable: boolean; Cells: PlannedCashCell[] }
export type PlannedCashRelationProof = { Available: boolean; CompletePublication: boolean; DatedOpeningVerified: boolean; CompletedMovementMonths: number
  WholePhysicalPairEmptyVerified?: true }
export type PlannedCashProof = { InputWitnessSha256: string; SnapshotVerified: true; Current: PlannedCashRelationProof; Previous: PlannedCashRelationProof | null
  Scenario: PlannedCashRelationProof | null; Receipts: PlannedCashRelationProof | null; Requests: PlannedCashRelationProof | null; LabelWitnessSha256: string
  ComparisonCurrencyStatus: 'Compatible' | 'Conflict' | 'Unverified' | 'NotApplicable' }
export type PlannedCashReport = typeof basis & {
  Version: 1; SourceIdentity: PlannedCashIdentity; Kind: PlannedCashKind; ReportName: string; Grouping: string; CurrentPeriod: PlannedCashPeriod
  PreviousPeriod: PlannedCashPeriod | null; PlanEndpoint: string | null; ScenarioBindingSha256: string | null; ScenarioChoiceBindingSha256: string | null; Columns: PlannedCashColumn[]
  Rows: PlannedCashGroup[]; Totals: PlannedCashCell[]; CurrentAvailable: boolean; PreviousAvailable: boolean | null; PlanAvailable: boolean
  Complete: boolean; HasRows: boolean; Code: string; AvailabilityMessage: string | null; GroupLabelsAvailabilityMessage: string | null
  PresentationBasis: 'CurrentGbaClrDecimal'; ResourceUnits: Array<typeof PLANNED_CASH_UNITS[number]>; Proof: PlannedCashProof
  ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string; RequestSha256: string; ResultSha256: string; DocumentURL: string; PdfDocumentURL: string
}
export const PLANNED_CASH_SCENARIO_PENDING = 'Вибір сценарію плану ще не доступний. Потрібен синхронізований список сценаріїв із підтвердженими назвами.'
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 2048 && v.trim() === v
const decimal = (v: unknown): v is string => typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v) && v.length <= 64
const kind = (v: unknown): v is PlannedCashKind => typeof v === 'string' && Object.hasOwn(PLANNED_CASH_FORMS, v)
const same = (v: unknown, expected: unknown) => JSON.stringify(v) === JSON.stringify(expected)
function identity(v: unknown): v is PlannedCashIdentity { return record(v) && Object.keys(v).length === 3 && v.World === 'fenix'
  && typeof v.SourceId === 'string' && /^0x[0-9a-f]{32}$/.test(v.SourceId) && hash(v.DefinitionSha256) }
export function plannedCashColumns(k: PlannedCashKind): PlannedCashColumn[] { return (PLANNED_CASH_FORMS[k].Scenario ? PLANNED_CASH_COLUMNS : [PLANNED_CASH_COLUMNS[0], PLANNED_CASH_COLUMNS[4]]).map(column => ({ ...column })) }
function columns(v: unknown, k: PlannedCashKind): boolean { return Array.isArray(v) && v.length === plannedCashColumns(k).length && v.every((column, i) => record(column)
  && Object.entries(plannedCashColumns(k)[i]).every(([key, value]) => column[key] === value)) }
function units(v: unknown): boolean { return Array.isArray(v) && v.length === PLANNED_CASH_UNITS.length && v.every((unit, i) => record(unit)
  && Object.entries(PLANNED_CASH_UNITS[i]).every(([key, value]) => unit[key] === value)) }
function hasBasis(v: Record<string, unknown>): boolean { return Object.entries(basis).every(([key, value]) => v[key] === value) }
export function plannedCashCatalogueKind(report: ReportCatalogueEntry): PlannedCashKind | null {
  return (Object.keys(PLANNED_CASH_FORMS) as PlannedCashKind[]).find(k => {
    const sources = report.Sources.filter(s => s.World === 'fenix' && s.SourceId === PLANNED_CASH_FORMS[k].SourceId)
    return report.Id === `custom:fenix:${PLANNED_CASH_FORMS[k].SourceId}` && sources.length === 1 && (sources[0].DefinitionSha256 === null || hash(sources[0].DefinitionSha256))
  }) ?? null
}
export function plannedCashCatalogueMatches(report: ReportCatalogueEntry, cap: PlannedCashCapabilities): boolean {
  return plannedCashCatalogueKind(report) === cap.Kind && isPlannedCashCapabilities(cap) && report.Sources.some(s => s.World === cap.SourceIdentity.World
    && s.SourceId === cap.SourceIdentity.SourceId && (s.DefinitionSha256 === null || s.DefinitionSha256 === cap.SourceIdentity.DefinitionSha256))
}
export function isPlannedCashCapabilities(v: unknown): v is PlannedCashCapabilities {
  if (!record(v) || !kind(v.Kind) || !identity(v.SourceIdentity)) return false
  const form = PLANNED_CASH_FORMS[v.Kind]
  return v.Version === 1 && v.SourceIdentity.SourceId === form.SourceId && v.ReportName === form.ReportName && v.Grouping === form.Grouping
    && v.ScopeKind === 'ExplicitCurrentOurIntervalsAndPlan' && same(v.Filters, form.Scenario ? ['CurrentPeriod', 'PreviousPeriod', 'Scenario'] : ['CurrentPeriod', 'PlanEndpoint'])
    && v.NativeScenarioParameterName === form.Scenario && v.NativePlanEndpointParameterName === form.Endpoint && v.SourceEmbeddedPeriodicity === form.Periodicity
    && hasBasis(v) && columns(v.Columns, v.Kind) && units(v.ResourceUnits) && typeof v.RuntimeImplemented === 'boolean'
    && v.RequiresCompleteNormalPublications === true && v.InputAvailability === 'CheckedByPreview' && v.RequiresObservedScenario === Boolean(form.Scenario)
    && v.ScenarioSelectionLabelsAvailable === false && v.ScenarioChoiceAvailability === (form.Scenario ? 'CheckedByChoices' : 'NotApplicable')
    && v.ScenarioChoiceApiImplemented === Boolean(form.Scenario) && v.NativeChoiceVisibilityVerified === false && v.GroupLabelAvailability === 'CheckedByPreview'
    && same(v.UnsupportedFilters, ['AdditionalSavedFilters', 'AdditionalSavedGrouping', 'AccountCurrencyMeasures', 'DocumentAttributeProjections', 'NativeEffectivePeriodAndHorizon'])
}
function localDate(v: string, upper: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v.slice(0, 4) === '0000' || Number(v.slice(0, 4)) >= upper) return false
  const n = Date.parse(`${v}T00:00:00.000Z`)
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === v
}
function wireDate(v: unknown, upper: number): v is string { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/.test(v)
  && localDate(v.slice(0, 10), upper) && v.slice(11, 13) <= '23' && v.slice(14, 16) <= '59' && v.slice(17, 19) <= '59' }
export function plannedCashPeriodFilterError(cap: PlannedCashCapabilities, filters: PlannedCashFilters): string | null {
  if (!localDate(filters.From, 8000) || !localDate(filters.ThroughExclusive, 8000) || filters.From >= filters.ThroughExclusive) return 'Оберіть допустимі межі періоду; кінцева дата не входить до нього.'
  if (cap.RequiresObservedScenario) {
    if (!localDate(filters.PreviousFrom, 8000) || !localDate(filters.PreviousThroughExclusive, 8000) || filters.PreviousFrom >= filters.PreviousThroughExclusive) return 'Оберіть допустимі межі попереднього періоду.'
    return null
  }
  return !localDate(filters.PlanEndpoint, 3999) ? 'Оберіть дату планового залишку.' : null
}
/** Selection comes only from the scoped server list; its encrypted contents are never interpreted here. */
export function isPlannedCashOpaqueKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || /\s/.test(value)) return false
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i)
    if (unit <= 0x1f || unit === 0x7f) return false
  }
  return true
}
export function plannedCashFilterError(cap: PlannedCashCapabilities, filters: PlannedCashFilters, scenarioChoiceKey?: string | null): string | null {
  const error = plannedCashPeriodFilterError(cap, filters)
  return error ?? (cap.RequiresObservedScenario && !isPlannedCashOpaqueKey(scenarioChoiceKey) ? 'Оберіть сценарій плану зі списку.' : null)
}
/** Explicit current GBA date choices, not inferred native effective periods or plan horizon. */
export function plannedCashDefaultFilters(cap: PlannedCashCapabilities, today: string): PlannedCashFilters {
  const empty = { From: '', ThroughExclusive: '', PreviousFrom: '', PreviousThroughExclusive: '', PlanEndpoint: '' }
  if (!localDate(today, 3999)) return empty
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7)), size = cap.SourceEmbeddedPeriodicity === 'Квартал' ? 3 : 1
  const first = year * 12 + Math.floor((month - 1) / size) * size
  const day = (index: number) => `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01`
  return { From: day(first), ThroughExclusive: day(first + size), PreviousFrom: day(first - size), PreviousThroughExclusive: day(first), PlanEndpoint: '' }
}
export function createPlannedCashRequest(cap: PlannedCashCapabilities, filters: PlannedCashFilters, scenarioChoiceKey?: string | null): PlannedCashRequest {
  if (!isPlannedCashCapabilities(cap) || !cap.RuntimeImplemented) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const error = plannedCashFilterError(cap, filters, scenarioChoiceKey); if (error) throw new Error(error)
  if (!cap.RequiresObservedScenario && scenarioChoiceKey != null) throw new Error('Ця форма не має вибору сценарію.')
  return { Version: cap.Version, SourceIdentity: { ...cap.SourceIdentity }, CurrentPeriod: { From: `${filters.From}T00:00:00.000`, ThroughExclusive: `${filters.ThroughExclusive}T00:00:00.000` },
    PreviousPeriod: cap.RequiresObservedScenario ? { From: `${filters.PreviousFrom}T00:00:00.000`, ThroughExclusive: `${filters.PreviousThroughExclusive}T00:00:00.000` } : null,
    PlanEndpoint: cap.RequiresObservedScenario ? null : `${filters.PlanEndpoint}T00:00:00.000`, Scenario: null,
    ...(cap.RequiresObservedScenario ? { ScenarioChoiceKey: scenarioChoiceKey } : {}) }
}
function period(v: unknown, expected: PlannedCashPeriod): boolean { return record(v) && Object.keys(v).length === 2
  && v.From === expected.From && v.ThroughExclusive === expected.ThroughExclusive && wireDate(v.From, 8000) && wireDate(v.ThroughExclusive, 8000) && v.From < v.ThroughExclusive }
function exact(v: unknown): boolean { return record(v) && typeof v.Numerator === 'string' && typeof v.Denominator === 'string'
  && v.Numerator.length <= 20000 && v.Denominator.length <= 20000 && /^(?:0|-?[1-9]\d*)$/.test(v.Numerator) && /^[1-9]\d*$/.test(v.Denominator) && (v.Numerator !== '0' || v.Denominator === '1') }
function cells(v: unknown, expected: PlannedCashColumn[]): v is PlannedCashCell[] {
  return Array.isArray(v) && v.length === expected.length && v.every((cell, i) => {
    if (!record(cell) || cell.Key !== expected[i].Key || typeof cell.Available !== 'boolean' || !(cell.ExactValue === null || exact(cell.ExactValue))) return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return cell.FormattedValue === null && cell.ExactValue === null
    return decimal(cell.Value) && decimal(cell.FormattedValue) && exact(cell.ExactValue) && (expected[i].DecimalPlaces !== 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function relation(v: unknown): v is PlannedCashRelationProof { return record(v) && typeof v.Available === 'boolean' && typeof v.CompletePublication === 'boolean'
  && typeof v.DatedOpeningVerified === 'boolean' && typeof v.CompletedMovementMonths === 'number' && Number.isSafeInteger(v.CompletedMovementMonths)
  && v.CompletedMovementMonths >= 0 && (!v.Available || v.CompletePublication)
  && (!('WholePhysicalPairEmptyVerified' in v) || v.WholePhysicalPairEmptyVerified === true) }
function turnoverRelation(v: unknown): v is PlannedCashRelationProof { return relation(v) && !v.DatedOpeningVerified && !('WholePhysicalPairEmptyVerified' in v) }
function plannedBalanceRelation(v: unknown): v is PlannedCashRelationProof { return relation(v)
  && !(v.DatedOpeningVerified && v.WholePhysicalPairEmptyVerified)
  && (!v.Available || v.DatedOpeningVerified || v.WholePhysicalPairEmptyVerified === true) }
function utc(v: unknown): v is string { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 23) === v.slice(0, 23) }
function proof(v: unknown, r: PlannedCashReport): v is PlannedCashProof {
  if (!record(v) || !hash(v.InputWitnessSha256) || !hash(v.LabelWitnessSha256) || v.SnapshotVerified !== true || !turnoverRelation(v.Current)) return false
  const dds = Boolean(PLANNED_CASH_FORMS[r.Kind].Scenario), receipts = r.Kind === 'NetFlow' || r.Kind === 'CalendarReceipts', requests = r.Kind === 'NetFlow' || r.Kind === 'CalendarPayouts'
  if (!(dds ? turnoverRelation(v.Previous) && turnoverRelation(v.Scenario) && v.Receipts === null && v.Requests === null
    : v.Previous === null && v.Scenario === null && (receipts ? plannedBalanceRelation(v.Receipts) : v.Receipts === null) && (requests ? plannedBalanceRelation(v.Requests) : v.Requests === null))) return false
  if (r.CurrentAvailable && !v.Current.Available || r.PreviousAvailable === true && !(record(v.Previous) && v.Previous.Available)
    || r.PlanAvailable && !(dds ? record(v.Scenario) && v.Scenario.Available : (!receipts || record(v.Receipts) && v.Receipts.Available) && (!requests || record(v.Requests) && v.Requests.Available))) return false
  return dds ? ['Compatible', 'Conflict', 'Unverified'].includes(String(v.ComparisonCurrencyStatus))
    && (v.ComparisonCurrencyStatus === 'Unverified' || r.CurrentAvailable && r.PreviousAvailable === true) : v.ComparisonCurrencyStatus === 'NotApplicable'
}
/** Checks only transport/scope/availability invariants. All financial presentation is server-authored. */
export function normalizePlannedCashReport(v: unknown, request: PlannedCashRequest): PlannedCashReport {
  const k = (Object.keys(PLANNED_CASH_FORMS) as PlannedCashKind[]).find(key => PLANNED_CASH_FORMS[key].SourceId === request.SourceIdentity.SourceId)
  if (!k || (PLANNED_CASH_FORMS[k].Scenario
    ? !isPlannedCashOpaqueKey(request.ScenarioChoiceKey) || request.PreviousPeriod === null || request.PlanEndpoint !== null
    : request.ScenarioChoiceKey != null || request.PreviousPeriod !== null) || request.Version !== 1 || !identity(request.SourceIdentity) || !record(v) || v.Version !== request.Version || !identity(v.SourceIdentity)
    || !Object.entries(request.SourceIdentity).every(([key, value]) => v.SourceIdentity && (v.SourceIdentity as PlannedCashIdentity)[key as keyof PlannedCashIdentity] === value)
    || v.Kind !== k || v.ReportName !== PLANNED_CASH_FORMS[k].ReportName || v.Grouping !== PLANNED_CASH_FORMS[k].Grouping
    || !period(v.CurrentPeriod, request.CurrentPeriod) || !(request.PreviousPeriod === null ? v.PreviousPeriod === null : period(v.PreviousPeriod, request.PreviousPeriod))
    || v.PlanEndpoint !== request.PlanEndpoint || !(request.PlanEndpoint === null || wireDate(v.PlanEndpoint, 3999))
    || request.Scenario !== null || !(request.ScenarioChoiceKey == null
      ? v.ScenarioBindingSha256 === null && v.ScenarioChoiceBindingSha256 === null
      : isPlannedCashOpaqueKey(request.ScenarioChoiceKey) && hash(v.ScenarioBindingSha256) && hash(v.ScenarioChoiceBindingSha256))
    || !columns(v.Columns, k) || !units(v.ResourceUnits) || !hasBasis(v) || v.PresentationBasis !== 'CurrentGbaClrDecimal'
    || !Array.isArray(v.Rows) || v.Rows.length > 200000 || !cells(v.Totals, plannedCashColumns(k))
    || typeof v.CurrentAvailable !== 'boolean' || !(v.PreviousAvailable === null || typeof v.PreviousAvailable === 'boolean') || typeof v.PlanAvailable !== 'boolean'
    || typeof v.Complete !== 'boolean' || typeof v.HasRows !== 'boolean' || !text(v.Code)
    || !(v.AvailabilityMessage === null || text(v.AvailabilityMessage)) || !(v.GroupLabelsAvailabilityMessage === null || text(v.GroupLabelsAvailabilityMessage))
    || !utc(v.ObservationStartedAtUtc) || !utc(v.ObservationCompletedAtUtc) || v.ObservationStartedAtUtc > v.ObservationCompletedAtUtc
    || !hash(v.RequestSha256) || !hash(v.ResultSha256) || !isManagementReturnsDocumentUrl(v.DocumentURL) || !isManagementReturnsDocumentUrl(v.PdfDocumentURL)) throw invalidPlannedCash()
  const keys = new Set<string>()
  for (const row of v.Rows) {
    if (!record(row) || !hash(row.Key) || keys.has(row.Key) || typeof row.GroupIsNull !== 'boolean' || typeof row.NameAvailable !== 'boolean'
      || !(row.NameAvailable ? typeof row.Name === 'string' && row.Name.length <= 2048 && row.Name.trim().length > 0 : row.Name === null) || row.GroupIsNull && (!row.NameAvailable || row.Name !== 'Без значення')
      || !cells(row.Cells, plannedCashColumns(k))) throw invalidPlannedCash()
    keys.add(row.Key)
  }
  const report = v as unknown as PlannedCashReport, dds = Boolean(PLANNED_CASH_FORMS[k].Scenario)
  for (const items of [report.Totals, ...report.Rows.map(row => row.Cells)]) {
    if (!report.CurrentAvailable && (items[0].Available || items[0].ExactValue !== null)
      || !report.PlanAvailable && (items[dds ? 4 : 1].Available || items[dds ? 4 : 1].ExactValue !== null)
      || dds && report.PreviousAvailable === false && (items[1].Available || items[1].ExactValue !== null || items[2].Available)) throw invalidPlannedCash()
  }
  if (!proof(report.Proof, report) || (report.PreviousAvailable === null) !== !dds || report.Complete !== (report.CurrentAvailable && report.PlanAvailable && (!dds || report.PreviousAvailable === true))
    || report.HasRows !== (report.Rows.length > 0) || (!report.Complete || !report.HasRows) && report.AvailabilityMessage === null
    || report.Rows.some(row => !row.NameAvailable) !== (report.GroupLabelsAvailabilityMessage !== null)) throw invalidPlannedCash()
  if (dds && report.Proof.ComparisonCurrencyStatus === 'Conflict' && ([report.Totals, ...report.Rows.map(row => row.Cells)].some(items => items.slice(2, 4).some(cell => cell.Available || cell.ExactValue !== null))
    || report.Code !== 'planned_cash_fact_management_currency_conflict' || report.AvailabilityMessage === null)) throw invalidPlannedCash()
  return report
}
export function invalidPlannedCash() { return new Error('Сервер повернув непідтверджений результат планування коштів або інші фільтри.') }
