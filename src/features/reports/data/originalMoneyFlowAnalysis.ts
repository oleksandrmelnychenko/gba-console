import type { ReportCatalogueEntry } from '../types'
import { statementPeriodError } from './originalCounterpartyStatement'

export const MONEY_FLOW_SOURCE = '9e7d129c-bc85-457f-88f4-91db2c620577'
export const MONEY_FLOW_DEFINITION = 'bea26eef9c0d6b9a00358fd373518e85f0501982af8a41dfb519ddeac0814610'
export const moneyFlowRows = ['Организация', 'СтатьяДвиженияДенежныхСредств'] as const
export const moneyFlowFilters = ['Организация', 'Подразделение', 'Проект'] as const
export const moneyFlowMeasures = ['СуммаПриходВал', 'СуммаРасходВал', 'ДенежныйПотокВал', 'СуммаПриходУпр', 'СуммаРасходУпр', 'ДенежныйПотокУпр'] as const
export const moneyFlowDefaults = ['СуммаПриходВал', 'ДенежныйПотокВал', 'СуммаПриходУпр', 'ДенежныйПотокУпр'] as const
export type MoneyFlowField = typeof moneyFlowFilters[number]
export type MoneyFlowMeasure = typeof moneyFlowMeasures[number]
export type MoneyFlowCaptionField = MoneyFlowField | typeof moneyFlowRows[number]
export type MoneyFlowSelection = Record<MoneyFlowField, string[]>
export type MoneyFlowValues = Record<string, string | null>
export type MoneyFlowChoice = { Key: string; Caption: string; CaptionAvailable: boolean }
export const moneyFlowLabels: Record<MoneyFlowCaptionField, string> = {
  Организация: 'Організація', СтатьяДвиженияДенежныхСредств: 'Стаття руху коштів', Подразделение: 'Підрозділ', Проект: 'Проєкт',
}
export const moneyFlowDefinitions = [
  { Key: 'СуммаПриходВал', Caption: 'Приход (вал.)', Scale: 2, CurrencyResource: 'AccountCurrency' },
  { Key: 'СуммаРасходВал', Caption: 'Расход (вал.)', Scale: 2, CurrencyResource: 'AccountCurrency' },
  { Key: 'ДенежныйПотокВал', Caption: 'Денежный поток (вал.)', Scale: 2, CurrencyResource: 'AccountCurrency' },
  { Key: 'СуммаПриходУпр', Caption: 'Приход (упр.)', Scale: 2, CurrencyResource: 'ManagementCurrency' },
  { Key: 'СуммаРасходУпр', Caption: 'Расход (упр.)', Scale: 2, CurrencyResource: 'ManagementCurrency' },
  { Key: 'ДенежныйПотокУпр', Caption: 'Денежный поток (упр.)', Scale: 2, CurrencyResource: 'ManagementCurrency' },
] as const
export const moneyFlowPolicies = {
  DefaultScopeCode: 'original_money_flow_analysis_default_v1',
  DatePolicy: 'DeclaredInclusiveBusinessDaysThroughLastWholeSecondNativeEffectivePeriodUnverified',
  MoneyPolicy: 'SignedStoredAccountAndManagementAmountsIncomeMinusExpenseNoFx',
  DivisionPolicy: 'PlanningUndefinedOrActualEmptyCfoUsesMovementDivisionOtherwiseActualPlanningCfo',
  MissingPropertyPolicy: 'UndeclaredMovementDivisionNativeNullSemanticsUnverifiedNoFallback',
  AppliesFxConversion: false, SourceParityVerified: false, OriginalFullTaskAccepted: false,
} as const
type Identity = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string }
export type MoneyFlowCapability = Identity & typeof moneyFlowPolicies & {
  ModuleSha256: string; QuerySha256: string; Executable: boolean; DefaultRows: string[]; DefaultColumns: string[];
  DefaultMeasures: string[]; Measures: string[]; Filters: string[]; MeasureDefinitions: ReadonlyArray<(typeof moneyFlowDefinitions)[number]>;
  MoneyScale: 2; ComparisonOperators: string[]; HumanChoicesAvailable: false; SourceSyncEnabled: false; NormalInputsReadinessVerified: false;
}
export type MoneyFlowRequest = Identity & { From: string; Through: string; Organizations: string[]; Divisions: string[]; Projects: string[]; Measures: MoneyFlowMeasure[] }
export type MoneyFlowRow = MoneyFlowChoice & { Field: typeof moneyFlowRows[number]; Values: MoneyFlowValues; Children: MoneyFlowRow[] }
export type MoneyFlowResult = Identity & typeof moneyFlowPolicies & {
  From: string; Through: string; Selectors: MoneyFlowSelection; Measures: MoneyFlowMeasure[];
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean; InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: MoneyFlowRow[]; Totals: MoneyFlowValues | null; Choices: Record<MoneyFlowField, MoneyFlowChoice[]>;
  MissingCaptionMappings: MoneyFlowCaptionField[]; ManagementCurrency: null | { Reference: string; Code: string; Marked: '00' | '01' };
  Dependency: null | { Kind: string; MissingMonth: string | null };
}
export const moneyFlowRequestFields = { Организация: 'Organizations', Подразделение: 'Divisions', Проект: 'Projects' } as const
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const digest = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) && !/^0+$/.test(v)
const caption = (v: unknown): v is string => typeof v === 'string' && !!v && v === v.trim() && !/\p{Cc}/u.test(v)
const exact = (v: unknown, expected: readonly unknown[]) => Array.isArray(v) && v.length === expected.length && v.every((item, i) => item === expected[i])
const keysEqual = (v: Record<string, unknown>, keys: readonly string[]) => exact(Object.keys(v).sort(), [...keys].sort())
const measureSet = new Set<string>(moneyFlowMeasures), captionFields = new Set<string>([...moneyFlowFilters, ...moneyFlowRows])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === MONEY_FLOW_SOURCE && v.DefinitionSha256 === MONEY_FLOW_DEFINITION
const policies = (v: Record<string, unknown>) => Object.entries(moneyFlowPolicies).every(([key, value]) => v[key] === value)
export function isMoneyFlowCapability(v: unknown): v is MoneyFlowCapability {
  if (!object(v) || !identity(v) || !policies(v) || !Array.isArray(v.MeasureDefinitions) || v.MeasureDefinitions.length !== 6) return false
  if (!v.MeasureDefinitions.every((d, i) => object(d) && keysEqual(d, ['Key', 'Caption', 'Scale', 'CurrencyResource'])
    && Object.entries(moneyFlowDefinitions[i]).every(([key, value]) => d[key] === value))) return false
  return v.ModuleSha256 === '74443e310aa9ac05212b811b144b56f23752d9c746e88b358058870bc8e882d8'
    && v.QuerySha256 === 'e9ab555188126e6bbd05c3b6ff9c6fc68814c26ab83a6832399ac667b0bcfaef'
    && typeof v.Executable === 'boolean' && v.MoneyScale === 2 && v.HumanChoicesAvailable === false
    && v.SourceSyncEnabled === false && v.NormalInputsReadinessVerified === false
    && exact(v.DefaultRows, moneyFlowRows) && exact(v.DefaultColumns, []) && exact(v.Filters, moneyFlowFilters)
    && exact(v.DefaultMeasures, moneyFlowDefaults) && exact(v.Measures, moneyFlowMeasures) && exact(v.ComparisonOperators, ['Equal', 'InList'])
}
export { statementPeriodError as moneyFlowPeriodError }
export function emptyMoneyFlowSelection(): MoneyFlowSelection { return { Организация: [], Подразделение: [], Проект: [] } }
function selectionValid(v: unknown): v is MoneyFlowSelection {
  return object(v) && keysEqual(v, moneyFlowFilters) && moneyFlowFilters.every(field => {
    const keys = v[field]
    return Array.isArray(keys) && keys.length <= 256 && keys.every(ref) && new Set(keys).size === keys.length
  })
}
function selectedMeasures(v: unknown): v is MoneyFlowMeasure[] {
  return Array.isArray(v) && v.length >= 1 && v.length <= 6 && v.every(m => typeof m === 'string' && measureSet.has(m)) && new Set(v).size === v.length
}
export function moneyFlowRequest(capability: MoneyFlowCapability, from: string, through: string, selection: MoneyFlowSelection = emptyMoneyFlowSelection(),
  measures: readonly MoneyFlowMeasure[] = moneyFlowDefaults): MoneyFlowRequest {
  if (!isMoneyFlowCapability(capability) || !capability.Executable || statementPeriodError(from, through) || !selectionValid(selection) || !selectedMeasures(measures))
    throw new Error('Некоректний період, показники або відбір аналізу руху коштів.')
  const selected = new Set(measures)
  return { Version: 1, World: 'fenix', SourceId: MONEY_FLOW_SOURCE, DefinitionSha256: MONEY_FLOW_DEFINITION, From: from, Through: through,
    Organizations: [...selection.Организация].sort(), Divisions: [...selection.Подразделение].sort(), Projects: [...selection.Проект].sort(),
    Measures: moneyFlowMeasures.filter(measure => selected.has(measure)) }
}
function requestValid(request: MoneyFlowRequest) {
  const selection = { Организация: request.Organizations, Подразделение: request.Divisions, Проект: request.Projects }
  if (!identity(request) || statementPeriodError(request.From, request.Through) || !selectionValid(selection) || !selectedMeasures(request.Measures)) return false
  const selected = new Set(request.Measures)
  return exact(request.Measures, moneyFlowMeasures.filter(measure => selected.has(measure)))
    && moneyFlowFilters.every(field => exact(selection[field], [...selection[field]].sort()))
}
function choice(v: unknown): v is MoneyFlowChoice & Record<string, unknown> {
  return object(v) && ref(v.Key) && caption(v.Caption) && typeof v.CaptionAvailable === 'boolean'
    && (v.CaptionAvailable ? humanCaption(v.Caption) : v.Caption === 'Назва недоступна')
}
const humanCaption = (v: string) => !ref(v) && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v) && !/^[0-9A-F]{2}:[0-9A-F]{8}:[0-9A-F]{32}$/.test(v)
export const moneyFlowHumanChoice = (v: MoneyFlowChoice) => v.CaptionAvailable && humanCaption(v.Caption)
function choices(v: unknown): v is MoneyFlowChoice[] {
  return Array.isArray(v) && v.length <= 500_000 && v.every(choice) && new Set(v.map(c => c.Key)).size === v.length
}
/** Validate exact stored strings and shape; no server money or subtotals are recomputed here. */
function values(v: unknown, measures: readonly MoneyFlowMeasure[], empty: boolean): v is MoneyFlowValues {
  return object(v) && keysEqual(v, measures) && measures.every(measure => {
    const value = v[measure]
    return empty ? value === null : typeof value === 'string' && value.length <= 100 && /^-?(0|[1-9]\d*)\.\d{2}$/.test(value) && value !== '-0.00'
  })
}
function hierarchy(rows: unknown[], request: MoneyFlowRequest): boolean {
  let count = 0
  const organizations = new Set(request.Organizations)
  function level(items: unknown[], depth: number): boolean {
    const siblings = new Set<string>()
    for (const item of items) {
      if (!object(item)) return false
      const children = item.Children
      if (!choice(item) || item.Field !== moneyFlowRows[depth] || siblings.has(item.Key) || ++count > 2_000_000
        || !values(item.Values, request.Measures, false) || !Array.isArray(children)) return false
      if (depth === 0 && organizations.size && !organizations.has(item.Key)) return false
      siblings.add(item.Key)
      if (depth === 1 ? children.length !== 0 : !children.length || !level(children, depth + 1)) return false
    }
    return true
  }
  return level(rows, 0)
}
export function normalizeMoneyFlow(v: unknown, request: MoneyFlowRequest): MoneyFlowResult {
  const fail = () => { throw new Error('Сервер не підтвердив повний аналіз руху коштів для поточного періоду, показників та відборів.') }
  if (!requestValid(request) || !object(v) || !identity(v) || !policies(v) || v.From !== request.From || v.Through !== request.Through
    || !selectionValid(v.Selectors) || !moneyFlowFilters.every(field => exact((v.Selectors as MoneyFlowSelection)[field], request[moneyFlowRequestFields[field]]))
    || !exact(v.Measures, request.Measures) || !Array.isArray(v.Rows) || typeof v.Available !== 'boolean' || v.NormalInputsComplete !== v.Available
    || typeof v.OurSnapshotVerified !== 'boolean' || !object(v.Choices) || !keysEqual(v.Choices, moneyFlowFilters)
    || !moneyFlowFilters.every(field => choices((v.Choices as Record<string, unknown>)[field]))
    || !Array.isArray(v.MissingCaptionMappings) || !v.MissingCaptionMappings.every(field => typeof field === 'string' && captionFields.has(field))
    || new Set(v.MissingCaptionMappings).size !== v.MissingCaptionMappings.length) return fail()
  if (!v.Available) {
    const dependency = v.Dependency
    if (v.OurSnapshotVerified || v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null || v.ManagementCurrency !== null
      || !Object.values(v.Choices).every(list => (list as unknown[]).length === 0) || v.MissingCaptionMappings.length
      || !object(dependency) || !caption(dependency.Kind) || dependency.MissingMonth !== null || v.Code !== `original_money_flow_analysis_${dependency.Kind}`) return fail()
    return structuredClone(v) as MoneyFlowResult
  }
  const currency = v.ManagementCurrency
  if (!v.OurSnapshotVerified || !digest(v.InputWitnessSha256) || !digest(v.ResultSha256) || v.Dependency !== null
    || !object(currency) || !ref(currency.Reference) || /^0+$/.test(currency.Reference) || typeof currency.Code !== 'string' || !/^\d{3}$/.test(currency.Code)
    || (currency.Marked !== '00' && currency.Marked !== '01') || !hierarchy(v.Rows, request) || !values(v.Totals, request.Measures, v.Rows.length === 0)
    || v.Code !== (v.Rows.length ? 'original_money_flow_analysis_available' : 'original_money_flow_analysis_empty')) return fail()
  return structuredClone(v) as MoneyFlowResult
}
export function isMoneyFlowCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:АнализДвиженияДенежныхСредств' && worlds.includes('fenix')
    && report.Sources.some(source => source.World === 'fenix' && source.SourceId === MONEY_FLOW_SOURCE && source.DefinitionSha256 === MONEY_FLOW_DEFINITION)
}
