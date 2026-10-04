import type { ReportCatalogueEntry } from '../types'
import { statementPeriodError } from './originalCounterpartyStatement'

export const DEFECT_COST_SOURCE = '91018d4c-1725-4249-bf06-72cf9c1991cc'
export const DEFECT_COST_DEFINITION = '058bebaeae48fc540953c3a46a4ebb52213865a6ca524b8c1b2ac90e39912782'
export const defectCostMeasures = ['НачОст', 'НачОстНДС', 'Приход', 'ПриходНДС', 'Расход', 'РасходНДС', 'КонОст', 'КонОстНДС'] as const
export const defectCostDefaultMeasures = ['НачОст', 'Приход', 'Расход', 'КонОст'] as const
export const defectCostFilters = ['Подразделение', 'СтатьяЗатрат'] as const
export type DefectCostMeasure = typeof defectCostMeasures[number]
export type DefectCostValues = Record<string, string>
export const defectCostLabels: Record<DefectCostMeasure, string> = {
  НачОст: 'Початковий залишок · вартість', НачОстНДС: 'Початковий залишок · ПДВ',
  Приход: 'Надходження · вартість', ПриходНДС: 'Надходження · ПДВ',
  Расход: 'Витрата · вартість', РасходНДС: 'Витрата · ПДВ',
  КонОст: 'Кінцевий залишок · вартість', КонОстНДС: 'Кінцевий залишок · ПДВ',
}
type DefectCostIdentity = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string }
export type DefectCostPolicies = {
  MoneyPolicy: 'NativeStoredManagementDefectCostNoFxConversion'; DatePolicy: 'InclusiveBusinessDaysThroughLastWholeSecond';
  AppliesFxConversion: false; ManagementCurrencyPresentationVerified: false; HumanChoicesAvailable: false;
  NativeDateParametersVerified: false; NativeVirtualRegistrarTotalsVerified: false; NativeZeroGroupSuppressionVerified: false;
  SourceParityVerified: false; OriginalFullTaskAccepted: false
}
export type DefectCostCapability = DefectCostIdentity & DefectCostPolicies & {
  ModuleSha256: string; QuerySha256: string; Executable: boolean; DefaultRows: string[]; Filters: string[];
  DefaultMeasures: string[]; Measures: string[]; DefaultScopeCode: 'original_defect_cost_default_v1';
  SourceSyncEnabled: false; NormalInputsReadinessVerified: false
}
export type DefectCostRequest = DefectCostIdentity & { From: string; Through: string; Divisions: string[]; CostArticles: string[]; Measures: DefectCostMeasure[] }
export type DefectCostArticle = { CostArticle: string; Values: DefectCostValues }
export type DefectCostDivision = { Division: string; Values: DefectCostValues; Articles: DefectCostArticle[] }
export type DefectCostResult = DefectCostRequest & DefectCostPolicies & {
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: true;
  InputWitnessSha256: string | null; ResultSha256: string | null; Rows: DefectCostDivision[]; Totals: DefectCostValues | null;
  Dependency: null | { Kind: string; MissingMonth: string | null }
}
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const digest = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) && !/^0+$/.test(v)
const exact = (v: unknown, expected: readonly string[]) => Array.isArray(v) && v.length === expected.length && v.every((x, i) => x === expected[i])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === DEFECT_COST_SOURCE && v.DefinitionSha256 === DEFECT_COST_DEFINITION
const policies = (v: Record<string, unknown>) => v.MoneyPolicy === 'NativeStoredManagementDefectCostNoFxConversion'
  && v.DatePolicy === 'InclusiveBusinessDaysThroughLastWholeSecond' && v.AppliesFxConversion === false && v.ManagementCurrencyPresentationVerified === false
  && v.HumanChoicesAvailable === false && v.NativeDateParametersVerified === false && v.NativeVirtualRegistrarTotalsVerified === false
  && v.NativeZeroGroupSuppressionVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isDefectCostCapability(v: unknown): v is DefectCostCapability {
  return object(v) && identity(v) && policies(v) && v.ModuleSha256 === '904223eb90566808807ae7d5979178994b790b90bfe59301428470e01639ea8a'
    && v.QuerySha256 === '6554eff394bbd7bef569f6ffedc5b32a1ac6bc4dbef71c62d1dcd8557c51a505' && typeof v.Executable === 'boolean'
    && exact(v.DefaultRows, defectCostFilters) && exact(v.Filters, defectCostFilters) && exact(v.DefaultMeasures, defectCostDefaultMeasures)
    && exact(v.Measures, defectCostMeasures) && v.DefaultScopeCode === 'original_defect_cost_default_v1'
    && v.SourceSyncEnabled === false && v.NormalInputsReadinessVerified === false
}
export { statementPeriodError as defectCostPeriodError }
/** Mirrors the detached server scope; metadata references are never accepted as user-facing captions. */
export function validateDefectCostRequest(v: DefectCostRequest): DefectCostRequest {
  if (!object(v) || !identity(v) || typeof v.From !== 'string' || typeof v.Through !== 'string' || statementPeriodError(v.From, v.Through)
    || [v.Divisions, v.CostArticles].some(keys => !Array.isArray(keys) || keys.length > 256 || !keys.every(ref) || new Set(keys).size !== keys.length)
    || !Array.isArray(v.Measures) || !v.Measures.length || v.Measures.length > 8 || !v.Measures.every(m => defectCostMeasures.includes(m))
    || new Set(v.Measures).size !== v.Measures.length) throw new Error('Некоректний запит вартості браку.')
  return { Version: 1, World: 'fenix', SourceId: DEFECT_COST_SOURCE, DefinitionSha256: DEFECT_COST_DEFINITION,
    From: v.From, Through: v.Through, Divisions: [...v.Divisions].sort(), CostArticles: [...v.CostArticles].sort(),
    Measures: defectCostMeasures.filter(m => v.Measures.includes(m)) }
}
export function defectCostRequest(capability: DefectCostCapability, from: string, through: string,
  divisions: readonly string[] = [], articles: readonly string[] = [], measures: readonly DefectCostMeasure[] = defectCostDefaultMeasures): DefectCostRequest {
  if (!isDefectCostCapability(capability) || !capability.Executable) throw new Error('Формування вартості браку недоступне.')
  return validateDefectCostRequest({ Version: 1, World: 'fenix', SourceId: DEFECT_COST_SOURCE, DefinitionSha256: DEFECT_COST_DEFINITION,
    From: from, Through: through, Divisions: [...divisions], CostArticles: [...articles], Measures: [...measures] })
}
export function defectCostCents(value: unknown): bigint {
  if (typeof value !== 'string' || value.length > 400 || !/^-?(0|[1-9]\d*)\.\d{2}$/.test(value) || value === '-0.00')
    throw new Error('Некоректна точна сума вартості браку.')
  return BigInt(value.replace('.', ''))
}
function values(v: unknown, measures: readonly DefectCostMeasure[]): v is DefectCostValues {
  return object(v) && exact(Object.keys(v).sort(), [...measures].sort()) && measures.every(m => { defectCostCents(v[m]); return true })
}
const sumEquals = (total: DefectCostValues, parts: DefectCostValues[], measures: readonly DefectCostMeasure[]) => measures.every(m =>
  defectCostCents(total[m]) === parts.reduce((sum, row) => sum + defectCostCents(row[m]), 0n))
/** Exact current selectors, signed strings and both subtotal levels are checked before display or export. */
export function normalizeDefectCost(v: unknown, request: DefectCostRequest): DefectCostResult {
  const scope = validateDefectCostRequest(request)
  const fail = () => { throw new Error('Сервер не підтвердив повну вартість браку для поточних параметрів.') }
  if (!object(v) || !identity(v) || !policies(v) || v.From !== scope.From || v.Through !== scope.Through
    || !exact(v.Divisions, scope.Divisions) || !exact(v.CostArticles, scope.CostArticles) || !exact(v.Measures, scope.Measures)
    || typeof v.Available !== 'boolean' || v.NormalInputsComplete !== v.Available || v.OurSnapshotVerified !== true
    || typeof v.Code !== 'string' || !v.Code.startsWith('original_defect_cost_') || !Array.isArray(v.Rows)) return fail()
  if (!v.Available) {
    if (v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null
      || !object(v.Dependency) || typeof v.Dependency.Kind !== 'string' || !/^[a-z_]+$/.test(v.Dependency.Kind)
      || v.Code !== `original_defect_cost_${v.Dependency.Kind}` || v.Dependency.MissingMonth !== null
        && (typeof v.Dependency.MissingMonth !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(v.Dependency.MissingMonth))) return fail()
    return structuredClone(v) as DefectCostResult
  }
  if (v.Code !== 'original_defect_cost_declared_calendar_complete' || v.Dependency !== null || !digest(v.InputWitnessSha256)
    || !digest(v.ResultSha256) || !values(v.Totals, scope.Measures) || v.Rows.length > 1_000_000) return fail()
  const selectedDivisions = new Set(scope.Divisions), selectedArticles = new Set(scope.CostArticles), divisions = new Set<string>()
  let articleCount = 0
  for (const row of v.Rows) {
    if (!object(row) || !ref(row.Division) || divisions.has(row.Division) || selectedDivisions.size && !selectedDivisions.has(row.Division)
      || !values(row.Values, scope.Measures) || !Array.isArray(row.Articles) || !row.Articles.length) return fail()
    divisions.add(row.Division); const articles = new Set<string>()
    for (const article of row.Articles) {
      if (!object(article) || !ref(article.CostArticle) || articles.has(article.CostArticle) || selectedArticles.size && !selectedArticles.has(article.CostArticle)
        || !values(article.Values, scope.Measures) || ++articleCount > 1_000_000) return fail()
      articles.add(article.CostArticle)
    }
    if (!sumEquals(row.Values, row.Articles.map(article => (article as DefectCostArticle).Values), scope.Measures)) return fail()
  }
  if (!sumEquals(v.Totals, v.Rows.map(row => (row as DefectCostDivision).Values), scope.Measures)) return fail()
  return structuredClone(v) as DefectCostResult
}
export function isDefectCostCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:БракВПроизводстве' && worlds.includes('fenix')
    && report.Sources.some(s => s.World === 'fenix' && s.SourceId === DEFECT_COST_SOURCE && s.DefinitionSha256 === DEFECT_COST_DEFINITION)
}
