import type { ReportCatalogueEntry } from '../types'
import { businessDay, exactReportNumber, referenceSelection, validReportUtf16, wireExact, wireHash, wireObject, wireReference } from './originalDefaultReportValidation'

export const PLANNED_FLOW_SOURCE = '5400433b-b9b6-4dc3-8699-86845c81588b'
export const PLANNED_FLOW_DEFINITION = '79900d4517da9c5c12d7c28890f31424e4527a0504a89cd73a337cdc4599cf6c'
export const plannedFlowMeasures = ['СуммаПриходВал', 'СуммаРасходВал', 'ДенежныйПотокВал', 'СуммаПриходУпр', 'СуммаРасходУпр', 'ДенежныйПотокУпр'] as const
export const plannedFlowDefaults = [plannedFlowMeasures[0], plannedFlowMeasures[2], plannedFlowMeasures[3], plannedFlowMeasures[5]]
export type PlannedFlowMeasure = typeof plannedFlowMeasures[number]
export const plannedFlowLabels: Record<PlannedFlowMeasure, string> = {
  СуммаПриходВал: 'Надходження у валюті', СуммаРасходВал: 'Витрата у валюті', ДенежныйПотокВал: 'Потік у валюті',
  СуммаПриходУпр: 'Управлінське надходження', СуммаРасходУпр: 'Управлінська витрата', ДенежныйПотокУпр: 'Управлінський потік',
}
export type PlannedFlowCapability = {
  World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; QuerySha256: string; Implemented: true;
  CurrentDataReadinessVerified: false; DefaultRows: string[]; DefaultColumns: string[]; Measures: PlannedFlowMeasure[]; DefaultMeasures: PlannedFlowMeasure[];
  FilterFields: string[]; HumanChoicesAvailable: false; ScopedChoicesImplemented?: boolean; SavedVariantsAvailable: false; NativeVirtualTableVerified: false;
  NativeHierarchyAndPeriodicityVerified: false; SourceParityVerified: false; AppliesFxConversion: false; OriginalFullTaskAccepted: false;
}
export type PlannedFlowRequest = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Scenarios: string[]; Projects: string[]; Departments: string[]; Measures: PlannedFlowMeasure[]; ChoicesWitnessSha256?: string }
export type PlannedFlowValues = Record<PlannedFlowMeasure, string>
export type PlannedFlowResult = Omit<PlannedFlowRequest, 'ChoicesWitnessSha256'> & { ChoicesWitnessSha256?: string | null; Grouping: string[]; Available: boolean; Code: string; NormalInputsComplete: boolean;
  OurSnapshotVerified: true; InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: { ArticleReference: string; Caption: string | null; Values: PlannedFlowValues }[]; Totals: PlannedFlowValues | null;
  AppliesFxConversion: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
const identity = (value: Record<string, unknown>) => value.World === 'fenix' && value.SourceId === PLANNED_FLOW_SOURCE && value.DefinitionSha256 === PLANNED_FLOW_DEFINITION
const limits = (value: Record<string, unknown>) => value.AppliesFxConversion === false && value.SourceParityVerified === false && value.OriginalFullTaskAccepted === false
export function isPlannedFlowCapability(value: unknown): value is PlannedFlowCapability {
  if (!wireObject(value) || !identity(value) || !limits(value)) return false
  return value.ModuleSha256 === 'a412b81d5055763fb2b66638485e9437b6e39d25f071c057c897f27fa6798b50'
    && value.QuerySha256 === '8264b082c5b33081f258e04d5a8fbe507d35fb5a81d9d19add2c12c58b0ae6c6' && value.Implemented === true
    && value.CurrentDataReadinessVerified === false && wireExact(value.DefaultRows, ['СтатьяДвиженияДенежныхСредств']) && wireExact(value.DefaultColumns, [])
    && wireExact(value.Measures, plannedFlowMeasures) && wireExact(value.DefaultMeasures, plannedFlowDefaults)
    && wireExact(value.FilterFields, ['Сценарий', 'Проект', 'Подразделение']) && value.HumanChoicesAvailable === false && value.SavedVariantsAvailable === false
    && value.NativeVirtualTableVerified === false && value.NativeHierarchyAndPeriodicityVerified === false
    && (value.ScopedChoicesImplemented === undefined || typeof value.ScopedChoicesImplemented === 'boolean')
}
export function plannedFlowPeriodError(from: string, through: string): string | null {
  const start = businessDay(from), end = businessDay(through)
  if (!start || !end || start > end || start.getUTCFullYear() < 1753 || end.getUTCFullYear() >= 3999) return 'Оберіть коректні початок і кінець періоду.'
  return end.getTime() - start.getTime() >= 366 * 86_400_000 ? 'Період має бути коротшим за 366 днів.' : null
}
export function plannedFlowRequest(capability: PlannedFlowCapability, from: string, through: string, measures: readonly PlannedFlowMeasure[],
  selection: PlannedFlowSelection = emptyPlannedFlowSelection(), choices: PlannedFlowChoices | null = null): PlannedFlowRequest {
  if (!isPlannedFlowCapability(capability) || plannedFlowPeriodError(from, through) || !measures.length || new Set(measures).size !== measures.length
    || measures.some(measure => !plannedFlowMeasures.includes(measure))) throw new Error('Некоректний запит плану руху коштів.')
  const refs = { Scenarios: referenceSelection(selection.Scenarios), Projects: referenceSelection(selection.Projects), Departments: referenceSelection(selection.Departments) }
  const selected = plannedFlowFields.some(field => refs[field].length > 0)
  if (selected && (capability.ScopedChoicesImplemented !== true || !choices || choices.From !== from || choices.Through !== through || !wireExact(choices.Measures, plannedFlowMeasures.filter(measure => measures.includes(measure)))
    || !plannedFlowSelectedStillNamed(choices, refs))) throw new Error('Оновіть повні назви для поточного періоду та відборів.')
  return { Version: 1, World: 'fenix', SourceId: PLANNED_FLOW_SOURCE, DefinitionSha256: PLANNED_FLOW_DEFINITION, From: from, Through: through,
    ...refs, Measures: plannedFlowMeasures.filter(measure => measures.includes(measure)), ...(selected ? { ChoicesWitnessSha256: choices!.ChoicesWitnessSha256! } : {}) }
}
function values(value: unknown): value is PlannedFlowValues {
  return wireObject(value) && Object.keys(value).length === 6 && plannedFlowMeasures.every(measure => exactReportNumber(value[measure], 2))
}
// Exact PlannedCashScenarioChoicesBinding.Caption: no trim, numeric/GUID heuristics or replacement.
function caption(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 100 && !/^\p{White_Space}*$/u.test(value) && validReportUtf16(value)
}
export function normalizePlannedFlow(value: unknown, request: PlannedFlowRequest): PlannedFlowResult {
  const fail = () => { throw new Error('Сервер не підтвердив повний план руху коштів для цього періоду та відборів.') }
  if (!wireObject(value) || !identity(value) || !limits(value) || value.Version !== 1 || value.From !== request.From || value.Through !== request.Through
    || !wireExact(value.Scenarios, request.Scenarios) || !wireExact(value.Projects, request.Projects) || !wireExact(value.Departments, request.Departments)
    || request.ChoicesWitnessSha256 !== undefined && value.ChoicesWitnessSha256 !== request.ChoicesWitnessSha256
    || !wireExact(value.Measures, request.Measures) || !wireExact(value.Grouping, ['СтатьяДвиженияДенежныхСредств'])
    || typeof value.Available !== 'boolean' || value.NormalInputsComplete !== value.Available || value.OurSnapshotVerified !== true || !Array.isArray(value.Rows)) return fail()
  if (!value.Available) {
    if (typeof value.Code !== 'string' || !value.Code.startsWith('planned_cash_flow_') || value.Rows.length || value.Totals !== null || value.InputWitnessSha256 !== null || value.ResultSha256 !== null) return fail()
    return value as unknown as PlannedFlowResult
  }
  if (value.Code !== 'available' || !wireHash(value.InputWitnessSha256) || !wireHash(value.ResultSha256) || value.Rows.length > 200_000
    || (value.Rows.length === 0 ? value.Totals !== null : !values(value.Totals))) return fail()
  const keys = new Set<string>()
  for (const row of value.Rows) {
    if (!wireObject(row) || !wireReference(row.ArticleReference) || keys.has(row.ArticleReference) || row.Caption !== null && !caption(row.Caption) || !values(row.Values)) return fail()
    keys.add(row.ArticleReference)
  }
  return value as unknown as PlannedFlowResult
}
export function isPlannedFlowCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:ПланыДвиженияДенежныхСредств' && worlds.includes('fenix')
    && report.Sources.some(source => source.World === 'fenix' && source.SourceId === PLANNED_FLOW_SOURCE && source.DefinitionSha256 === PLANNED_FLOW_DEFINITION)
}

export const plannedFlowFields = ['Scenarios', 'Projects', 'Departments'] as const
export type PlannedFlowField = typeof plannedFlowFields[number]
export const plannedFlowFieldLabels: Record<PlannedFlowField, string> = { Scenarios: 'Сценарій', Projects: 'Проєкт', Departments: 'Підрозділ' }
export type PlannedFlowSelection = Record<PlannedFlowField, string[]>
export type PlannedFlowNamedChoice = { Value: string; Caption: string }
export type PlannedFlowChoiceField = { Field: PlannedFlowField; Available: boolean; Code: string; Choices: PlannedFlowNamedChoice[] }
export type PlannedFlowChoices = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  RequestedScenarios: string[]; RequestedProjects: string[]; RequestedDepartments: string[]; Measures: PlannedFlowMeasure[];
  Available: boolean; Code: string; FullParentScopeVerified: boolean; OurSnapshotVerified: true; ChoicesWitnessSha256: string | null;
  Fields: PlannedFlowChoiceField[]; HumanChoicesAvailable: boolean; AppliesFxConversion: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export const emptyPlannedFlowSelection = (): PlannedFlowSelection => ({ Scenarios: [], Projects: [], Departments: [] })
export function normalizePlannedFlowChoices(value: unknown, request: PlannedFlowRequest): PlannedFlowChoices {
  const fail = () => { throw new Error('Сервер не підтвердив повний перелік назв для поточного плану руху коштів.') }
  if (!wireObject(value) || !identity(value) || !limits(value) || value.Version !== 1 || value.From !== request.From || value.Through !== request.Through
    || !wireExact(value.RequestedScenarios, request.Scenarios) || !wireExact(value.RequestedProjects, request.Projects) || !wireExact(value.RequestedDepartments, request.Departments)
    || !wireExact(value.Measures, request.Measures) || typeof value.Available !== 'boolean' || value.FullParentScopeVerified !== value.Available
    || value.OurSnapshotVerified !== true || typeof value.HumanChoicesAvailable !== 'boolean' || !Array.isArray(value.Fields) || value.Fields.length !== 3) return fail()
  if (value.Available ? value.Code !== 'available' || !wireHash(value.ChoicesWitnessSha256)
    : typeof value.Code !== 'string' || !value.Code.startsWith('planned_cash_flow_') || value.ChoicesWitnessSha256 !== null) return fail()
  let available = false
  for (let n = 0; n < plannedFlowFields.length; n++) {
    const field = value.Fields[n]
    if (!wireObject(field) || field.Field !== plannedFlowFields[n] || typeof field.Available !== 'boolean' || !Array.isArray(field.Choices) || field.Choices.length > 200_000) return fail()
    if (field.Available) {
      if (!value.FullParentScopeVerified || field.Code !== 'available') return fail()
      available = true
    } else if (field.Choices.length || typeof field.Code !== 'string' || !/^(planning_name_|planned_cash_flow_)/.test(field.Code)) return fail()
    const keys = new Set<string>()
    for (const choice of field.Choices) {
      if (!wireObject(choice) || !wireReference(choice.Value) || keys.has(choice.Value) || !caption(choice.Caption)) return fail()
      keys.add(choice.Value)
    }
  }
  if (value.HumanChoicesAvailable !== available) return fail()
  return value as unknown as PlannedFlowChoices
}
export function plannedFlowSelectedStillNamed(current: PlannedFlowChoices | null, selection: PlannedFlowSelection) {
  return plannedFlowFields.every(field => {
    if (selection[field].length === 0) return true
    const offered = current?.Fields.find(item => item.Field === field)
    const keys = new Set(offered?.Choices.map(choice => choice.Value) ?? [])
    return !!current?.FullParentScopeVerified && wireHash(current.ChoicesWitnessSha256) && offered?.Available === true && selection[field].every(key => keys.has(key))
  })
}
