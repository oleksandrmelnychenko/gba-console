import type { ReportCatalogueEntry } from '../types'
import { statementPeriodError } from './originalCounterpartyStatement'
export const WIP_SOURCE = 'f494f067-f568-4913-a896-83e5c972ce99'
export const WIP_DEFINITION = '972aaec8037746fed0bfa5df7be7cf88d56666aa2e963a88c385d1bc2224e5f4'
export const wipFilters = ['Подразделение', 'НоменклатурнаяГруппа', 'СтатьяЗатрат'] as const
export const wipMeasures = ['НачОст', 'НачОстНДС', 'Приход', 'ПриходНДС', 'НоменклатураЗатратКоличество', 'Расход', 'РасходНДС', 'КонОст', 'КонОстНДС'] as const
export const wipDefaults = ['НачОст', 'Приход', 'Расход', 'КонОст'] as const
const wipMeasureSet: ReadonlySet<string> = new Set(wipMeasures)
const wipFilterSet: ReadonlySet<string> = new Set(wipFilters)
export type WipFilter = typeof wipFilters[number]
export type WipMeasure = typeof wipMeasures[number]
export type WipSelection = { Divisions: string[]; ProductGroups: string[]; CostArticles: string[] }
export const wipField = { Подразделение: 'Divisions', НоменклатурнаяГруппа: 'ProductGroups', СтатьяЗатрат: 'CostArticles' } as const
export type WipRequest = WipSelection & { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; From: string; Through: string; Measures: WipMeasure[] }
type WipPolicy = { MoneyPolicy: 'NativeStoredManagementWipNoFxConversion'; QuantityPolicy: 'NativeMaterialQuantityNoUnitConversion'; DatePolicy: 'InclusiveBusinessDaysThroughLastWholeSecond'; AppliesFxConversion: false; ManagementCurrencyPresentationVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type WipCapability = WipPolicy & { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; QuerySha256: string; Executable: boolean; DefaultRows: string[]; Filters: string[]; DefaultMeasures: string[]; Measures: string[] }
export type WipValues = Partial<Record<WipMeasure, string>>
export type WipChoice = { Key: string; Caption: string }
export type WipArticle = { CostArticle: string | null; Caption: string; CaptionAvailable: boolean; Values: WipValues }
export type WipGroup = { ProductGroup: string; Caption: string; CaptionAvailable: boolean; Values: WipValues; Articles: WipArticle[] }
export type WipDivision = { Division: string; Caption: string; CaptionAvailable: boolean; Values: WipValues; ProductGroups: WipGroup[] }
export type WipResult = WipRequest & WipPolicy & { Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: true; InputWitnessSha256: string | null; ResultSha256: string | null; Rows: WipDivision[]; Totals: WipValues | null; Choices: Record<WipFilter, WipChoice[]>; MissingCaptionMappings: WipFilter[]; Dependency: null | { Kind: string; MissingMonth: string | null } }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) && !/^0+$/.test(v)
const label = (v: unknown): v is string => typeof v === 'string' && !!v && v === v.trim() && !/\p{Cc}/u.test(v)
const exact = (v: unknown, a: readonly unknown[]) => Array.isArray(v) && v.length === a.length && v.every((x, i) => x === a[i])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === WIP_SOURCE && v.DefinitionSha256 === WIP_DEFINITION && v.MoneyPolicy === 'NativeStoredManagementWipNoFxConversion' && v.QuantityPolicy === 'NativeMaterialQuantityNoUnitConversion' && v.DatePolicy === 'InclusiveBusinessDaysThroughLastWholeSecond' && v.AppliesFxConversion === false && v.ManagementCurrencyPresentationVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isWipCapability(v: unknown): v is WipCapability {
  return obj(v) && identity(v) && v.ModuleSha256 === '34bddabf9b367769b4443c2ad1bb4f425aa3f9b8d02bba96004c35d62a0576bd' && v.QuerySha256 === '6c4f1a9dcce89113ddf44c399ea1985df1a97df7d403468c1c32417555cac368' && typeof v.Executable === 'boolean' && exact(v.DefaultRows, wipFilters) && exact(v.Filters, wipFilters) && exact(v.DefaultMeasures, wipDefaults) && exact(v.Measures, wipMeasures)
}
export const wipPeriodError = statementPeriodError
export function wipRequest(cap: WipCapability, from: string, through: string, selection: WipSelection, measures: readonly WipMeasure[] = wipDefaults): WipRequest {
  if (!isWipCapability(cap) || statementPeriodError(from, through) || !measures.length || new Set(measures).size !== measures.length || measures.some(m => !wipMeasureSet.has(m)) || Object.values(selection).some(a => a.length > 256 || !a.every(ref) || new Set(a).size !== a.length)) throw new Error('Некоректний період або відбір незавершеного виробництва.')
  const selectedMeasures = new Set(measures)
  return { Version: 1, World: 'fenix', SourceId: WIP_SOURCE, DefinitionSha256: WIP_DEFINITION, From: from, Through: through, Divisions: [...selection.Divisions].sort(), ProductGroups: [...selection.ProductGroups].sort(), CostArticles: [...selection.CostArticles].sort(), Measures: wipMeasures.filter(m => selectedMeasures.has(m)) }
}
function values(v: unknown, measures: readonly WipMeasure[]): v is WipValues {
  return obj(v) && exact(Object.keys(v), measures) && measures.every(m => { const s = v[m], scale = m === 'НоменклатураЗатратКоличество' ? 3 : 2
    return typeof s === 'string' && s.length <= 400 && new RegExp(`^-?(0|[1-9]\\d*)\\.\\d{${scale}}$`).test(s) && s !== `-0.${'0'.repeat(scale)}` })
}
const choices = (v: unknown): v is WipChoice[] => Array.isArray(v) && v.every(c => obj(c) && ref(c.Key) && !/^0+$/.test(c.Key) && label(c.Caption)) && new Set(v.map(c => c.Key)).size === v.length
function adds(parent: WipValues, children: WipValues[], measures: readonly WipMeasure[]) { return measures.every(m => BigInt(parent[m]!.replace('.', '')) === children.reduce((sum, c) => sum + BigInt(c[m]!.replace('.', '')), 0n)) }
export function normalizeWip(v: unknown, request: WipRequest): WipResult {
  const fail = () => { throw new Error('Сервер не підтвердив повне незавершене виробництво для поточних відборів.') }
  if (!obj(v) || !identity(v) || v.From !== request.From || v.Through !== request.Through || !exact(v.Measures, request.Measures) || (['Divisions', 'ProductGroups', 'CostArticles'] as const).some(k => !exact(v[k], request[k])) || typeof v.Available !== 'boolean' || v.NormalInputsComplete !== v.Available || v.OurSnapshotVerified !== true || typeof v.Code !== 'string' || !v.Code.startsWith('original_work_in_progress_') || !Array.isArray(v.Rows) || !obj(v.Choices) || !wipFilters.every(f => choices((v.Choices as Record<string, unknown>)[f])) || !Array.isArray(v.MissingCaptionMappings) || !v.MissingCaptionMappings.every(f => wipFilterSet.has(f)) || new Set(v.MissingCaptionMappings).size !== v.MissingCaptionMappings.length) return fail()
  if (!v.Available) {
    const d = v.Dependency
    if (v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null || !wipFilters.every(f => !(v.Choices as Record<string, WipChoice[]>)[f].length) || !obj(d) || !label(d.Kind) || d.MissingMonth !== null && (typeof d.MissingMonth !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(d.MissingMonth))) return fail()
    return v as unknown as WipResult
  }
  if (v.Code !== 'original_work_in_progress_complete' || v.Dependency !== null || !digest(v.InputWitnessSha256) || !digest(v.ResultSha256) || !values(v.Totals, request.Measures)) return fail()
  const selectedDivisions = new Set(request.Divisions), selectedGroups = new Set(request.ProductGroups), selectedArticles = new Set(request.CostArticles)
  const divisions = new Set<string>(), rows: WipDivision[] = []
  for (const d of v.Rows) {
    if (!obj(d) || !ref(d.Division) || divisions.has(d.Division) || request.Divisions.length && !selectedDivisions.has(d.Division) || !label(d.Caption) || typeof d.CaptionAvailable !== 'boolean' || !values(d.Values, request.Measures) || !Array.isArray(d.ProductGroups) || !d.ProductGroups.length) return fail()
    divisions.add(d.Division); const groups = new Set<string>(), childGroups: WipGroup[] = []
    for (const g of d.ProductGroups) {
      if (!obj(g) || !ref(g.ProductGroup) || groups.has(g.ProductGroup) || request.ProductGroups.length && !selectedGroups.has(g.ProductGroup) || !label(g.Caption) || typeof g.CaptionAvailable !== 'boolean' || !values(g.Values, request.Measures) || !Array.isArray(g.Articles) || !g.Articles.length) return fail()
      groups.add(g.ProductGroup); const articles = new Set<string | null>(), childArticles: WipArticle[] = []
      for (const a of g.Articles) {
        if (!obj(a) || a.CostArticle !== null && !ref(a.CostArticle) || articles.has(a.CostArticle as string | null) || request.CostArticles.length && !selectedArticles.has(a.CostArticle as string) || !label(a.Caption) || typeof a.CaptionAvailable !== 'boolean' || !values(a.Values, request.Measures)) return fail()
        articles.add(a.CostArticle as string | null); childArticles.push(a as WipArticle)
      }
      if (!adds(g.Values, childArticles.map(a => a.Values), request.Measures)) return fail()
      childGroups.push(g as unknown as WipGroup)
    }
    if (!adds(d.Values, childGroups.map(g => g.Values), request.Measures)) return fail()
    rows.push(d as unknown as WipDivision)
  }
  if (!adds(v.Totals, rows.map(d => d.Values), request.Measures)) return fail()
  return v as unknown as WipResult
}
export function isWipCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:НезавершенноеПроизводство' && worlds.includes('fenix') && report.Sources.some(s => s.World === 'fenix' && s.SourceId === WIP_SOURCE && s.DefinitionSha256 === WIP_DEFINITION)
}
