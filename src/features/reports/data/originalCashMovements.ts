import type { ReportCatalogueEntry } from '../types'
import { statementPeriodError } from './originalCounterpartyStatement'

export const CASH_MOVEMENTS_SOURCE = 'ecd83b31-5546-4832-bd65-daea9ef61431'
export const CASH_MOVEMENTS_DEFINITION = '74a2034d16ab6a44297424e2814f306eccbdc4c59e85558370940f8d41a1cc05'
export const cashMovementsRows = ['ВалютаДенежныхСредств', 'ПриходРасход', 'БанковскийСчетКасса', 'СтатьяДвиженияДенежныхСредств'] as const
export const cashMovementsFilters = ['ВалютаДенежныхСредств', 'ВидДенежныхСредств', 'ПриходРасход', 'Организация', 'БанковскийСчетКасса', 'СтатьяДвиженияДенежныхСредств', 'Проект', 'Контрагент'] as const
export const cashMovementsMeasures = ['СуммаОборот', 'СуммаУпрОборот'] as const
export type CashMovementsField = typeof cashMovementsFilters[number]
export type CashMovementsMeasure = typeof cashMovementsMeasures[number]
export type CashMovementsSelection = Record<CashMovementsField, string[]>
export type CashMovementsValues = Record<CashMovementsMeasure, string | null>
export type CashMovementsChoice = { Key: string; Caption: string; CaptionAvailable: boolean }
export const cashMovementsLabels: Record<CashMovementsField, string> = {
  ВалютаДенежныхСредств: 'Валюта коштів', ВидДенежныхСредств: 'Вид коштів', ПриходРасход: 'Прихід / витрата', Организация: 'Організація',
  БанковскийСчетКасса: 'Банківський рахунок / каса', СтатьяДвиженияДенежныхСредств: 'Стаття руху коштів', Проект: 'Проєкт', Контрагент: 'Контрагент',
}
export const cashMovementsDefinitions = [
  { Key: 'СуммаОборот', Caption: 'Сумма (оборот)', Scale: 2, CurrencyResource: 'AccountCurrency' },
  { Key: 'СуммаУпрОборот', Caption: 'Сумма упр. учета (оборот)', Scale: 2, CurrencyResource: 'ManagementCurrency' },
] as const
export const cashMovementsPolicies = {
  DefaultScopeCode: 'OriginalDefaultCurrencyDirectionAccountArticleByMoneyKind',
  MoneyPolicy: 'TwoSignedStoredResourcesAccountCurrencyAndManagementCurrencyNoFx',
  DatePolicy: 'InclusiveBusinessDaysThroughLastWholeSecond',
  ZeroRowPolicy: 'BothResourcesZeroAtFullRegisterRecorderPeriodGrainExcludedBeforeDisplayGrouping',
  EmptyCellPolicy: 'NoContributingVirtualRowIsNullRealSignedCancellationIsNumericZero',
  AppliesFxConversion: false, SourceParityVerified: false, OriginalFullTaskAccepted: false,
} as const
type Identity = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string }
type Policies = typeof cashMovementsPolicies
export type CashMovementsCapability = Identity & Policies & {
  ModuleSha256: string; UniversalModuleSha256: string; Executable: boolean; DefaultRows: string[]; DefaultColumns: string[];
  Filters: string[]; DefaultMeasures: string[]; Measures: string[]; MeasureDefinitions: ReadonlyArray<(typeof cashMovementsDefinitions)[number]>;
  MoneyScale: 2; ComparisonOperators: string[];
}
export type CashMovementsRequest = Identity & { From: string; Through: string; Currencies: string[]; MoneyKinds: string[]; Directions: string[];
  Organizations: string[]; Accounts: string[]; Articles: string[]; Projects: string[]; Counterparties: string[] }
export type CashMovementsTotals = { Values: CashMovementsValues; ByMoneyKind: Record<string, CashMovementsValues> }
export type CashMovementsRow = CashMovementsTotals & { Field: typeof cashMovementsRows[number]; Key: string; Caption: string; CaptionAvailable: boolean; Children: CashMovementsRow[] }
export type CashMovementsResult = Identity & Policies & { From: string; Through: string; Selectors: CashMovementsSelection; Measures: CashMovementsMeasure[];
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: true; InputWitnessSha256: string | null; ResultSha256: string | null;
  Columns: CashMovementsChoice[]; Rows: CashMovementsRow[]; Totals: CashMovementsTotals | null;
  Choices: Record<CashMovementsField, CashMovementsChoice[]>; MissingCaptionMappings: CashMovementsField[];
  ManagementCurrency: null | { Reference: string; Code: string; Marked: '00' | '01' };
  Dependency: null | { Kind: string; MissingMonth: string | null }; MeasureDefinitions: ReadonlyArray<(typeof cashMovementsDefinitions)[number]>;
  MixedCurrencyTotalPolicy: 'OriginalArithmeticSumOfStoredResourcesWithoutCommonCurrencyConversion' }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const typed = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{2}:[0-9A-F]{8}:[0-9A-F]{32}$/.test(v)
const digest = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) && !/^0+$/.test(v)
const caption = (v: unknown): v is string => typeof v === 'string' && !!v && v === v.trim() && !/\p{Cc}/u.test(v)
const exact = (v: unknown, expected: readonly unknown[]) => Array.isArray(v) && v.length === expected.length && v.every((item, i) => item === expected[i])
const fieldSet = new Set<string>(cashMovementsFilters)
const typedFields = new Set<CashMovementsField>(['БанковскийСчетКасса', 'Контрагент'])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === CASH_MOVEMENTS_SOURCE && v.DefinitionSha256 === CASH_MOVEMENTS_DEFINITION
const policies = (v: Record<string, unknown>) => Object.entries(cashMovementsPolicies).every(([key, value]) => v[key] === value)
const keysEqual = (v: Record<string, unknown>, keys: readonly string[]) => exact(Object.keys(v).sort(), [...keys].sort())
const definitions = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every((item, i) => object(item)
  && keysEqual(item, ['Key', 'Caption', 'Scale', 'CurrencyResource']) && Object.entries(cashMovementsDefinitions[i]).every(([key, value]) => item[key] === value))
export function isCashMovementsCapability(v: unknown): v is CashMovementsCapability {
  if (!object(v) || !identity(v) || !policies(v) || !definitions(v.MeasureDefinitions)) return false
  return v.ModuleSha256 === '2ecb0998253f3bf296a7334aae01a0886b9aa8594986d8b0f030282bf8a62ab6'
    && v.UniversalModuleSha256 === 'c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17'
    && typeof v.Executable === 'boolean' && v.MoneyScale === 2 && exact(v.ComparisonOperators, ['Equal', 'InList'])
    && exact(v.DefaultRows, cashMovementsRows) && exact(v.DefaultColumns, ['ВидДенежныхСредств']) && exact(v.Filters, cashMovementsFilters)
    && exact(v.DefaultMeasures, cashMovementsMeasures) && exact(v.Measures, cashMovementsMeasures)
}
export { statementPeriodError as cashMovementsPeriodError }
export function cashMovementsKey(field: CashMovementsField, v: unknown): v is string {
  if (typedFields.has(field)) return typed(v)
  return ref(v) || field === 'ВалютаДенежныхСредств' && v === 'NULL'
}
export function emptyCashMovementsSelection(): CashMovementsSelection {
  return { ВалютаДенежныхСредств: [], ВидДенежныхСредств: [], ПриходРасход: [], Организация: [], БанковскийСчетКасса: [], СтатьяДвиженияДенежныхСредств: [], Проект: [], Контрагент: [] }
}
export const cashMovementsRequestFields: Record<CashMovementsField, keyof Pick<CashMovementsRequest, 'Currencies' | 'MoneyKinds' | 'Directions' | 'Organizations' | 'Accounts' | 'Articles' | 'Projects' | 'Counterparties'>> = {
  ВалютаДенежныхСредств: 'Currencies', ВидДенежныхСредств: 'MoneyKinds', ПриходРасход: 'Directions', Организация: 'Organizations',
  БанковскийСчетКасса: 'Accounts', СтатьяДвиженияДенежныхСредств: 'Articles', Проект: 'Projects', Контрагент: 'Counterparties',
}
function selectionValid(v: unknown): v is CashMovementsSelection {
  return object(v) && keysEqual(v, cashMovementsFilters) && cashMovementsFilters.every(field => {
    const keys = v[field]
    return Array.isArray(keys) && keys.length <= 256 && keys.every(key => cashMovementsKey(field, key)) && new Set(keys).size === keys.length
  })
}
export function cashMovementsRequest(capability: CashMovementsCapability, from: string, through: string,
  selected: CashMovementsSelection = emptyCashMovementsSelection()): CashMovementsRequest {
  if (!isCashMovementsCapability(capability) || !capability.Executable || statementPeriodError(from, through) || !selectionValid(selected))
    throw new Error('Некоректний період або відбір рухів коштів.')
  const request: CashMovementsRequest = { Version: 1, World: 'fenix', SourceId: CASH_MOVEMENTS_SOURCE, DefinitionSha256: CASH_MOVEMENTS_DEFINITION,
    From: from, Through: through, Currencies: [], MoneyKinds: [], Directions: [], Organizations: [], Accounts: [], Articles: [], Projects: [], Counterparties: [] }
  for (const field of cashMovementsFilters) request[cashMovementsRequestFields[field]] = [...selected[field]].sort()
  return request
}
function choice(v: unknown, field: CashMovementsField): v is CashMovementsChoice {
  return object(v) && cashMovementsKey(field, v.Key) && caption(v.Caption) && typeof v.CaptionAvailable === 'boolean'
}
function choices(v: unknown, field: CashMovementsField): v is CashMovementsChoice[] {
  return Array.isArray(v) && v.length <= 500_000 && v.every(c => choice(c, field)) && new Set(v.map(c => c.Key)).size === v.length
}
/** Shape validation only: totals and pivot resources are never recomputed in the Console. */
function values(v: unknown): v is CashMovementsValues {
  if (!object(v) || !keysEqual(v, cashMovementsMeasures)) return false
  const cells = cashMovementsMeasures.map(measure => v[measure])
  return cells.every(value => value === null || typeof value === 'string' && value.length <= 100 && /^-?(0|[1-9]\d*)\.\d{2}$/.test(value) && value !== '-0.00')
    && (cells[0] === null) === (cells[1] === null)
}
function totals(v: unknown, columns: readonly string[]): v is CashMovementsTotals {
  return object(v) && values(v.Values) && object(v.ByMoneyKind) && keysEqual(v.ByMoneyKind, columns) && Object.values(v.ByMoneyKind).every(values)
}
function echo(v: Record<string, unknown>, request: CashMovementsRequest) {
  return v.From === request.From && v.Through === request.Through && selectionValid(v.Selectors)
    && cashMovementsFilters.every(field => exact((v.Selectors as CashMovementsSelection)[field], request[cashMovementsRequestFields[field]]))
}
function commonResult(v: Record<string, unknown>, request: CashMovementsRequest) {
  if (!identity(v) || !policies(v) || !echo(v, request) || !definitions(v.MeasureDefinitions)) return false
  if (v.NormalInputsComplete !== v.Available || v.OurSnapshotVerified !== true || typeof v.Available !== 'boolean') return false
  if (!exact(v.Measures, cashMovementsMeasures) || !Array.isArray(v.Rows) || !choices(v.Columns, 'ВидДенежныхСредств')) return false
  if (!object(v.Choices) || !keysEqual(v.Choices, cashMovementsFilters)
    || !cashMovementsFilters.every(field => choices((v.Choices as Record<string, unknown>)[field], field))) return false
  return v.MixedCurrencyTotalPolicy === 'OriginalArithmeticSumOfStoredResourcesWithoutCommonCurrencyConversion'
    && Array.isArray(v.MissingCaptionMappings) && v.MissingCaptionMappings.every(field => typeof field === 'string' && fieldSet.has(field))
    && new Set(v.MissingCaptionMappings).size === v.MissingCaptionMappings.length
    && typeof v.Code === 'string' && v.Code.startsWith('original_cash_movements_')
}
function unavailable(v: Record<string, unknown>) {
  if ((v.Rows as unknown[]).length || (v.Columns as unknown[]).length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null || v.ManagementCurrency !== null) return false
  if (!Object.values(v.Choices as Record<string, unknown[]>).every(list => list.length === 0) || (v.MissingCaptionMappings as unknown[]).length) return false
  const dependency = v.Dependency
  return object(dependency) && caption(dependency.Kind) && (dependency.MissingMonth === null || typeof dependency.MissingMonth === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(dependency.MissingMonth))
}
function managementCurrency(v: unknown) {
  return object(v) && ref(v.Reference) && !/^0+$/.test(v.Reference) && typeof v.Code === 'string' && /^\d{3}$/.test(v.Code) && (v.Marked === '00' || v.Marked === '01')
}
function hierarchy(v: unknown[], columns: string[], request: CashMovementsRequest): boolean {
  let count = 0
  function level(rows: unknown[], depth: number): boolean {
    const field = cashMovementsRows[depth], siblings = new Set<string>(), selected = new Set(request[cashMovementsRequestFields[field]])
    for (const row of rows) {
      if (!object(row) || row.Field !== field || !choice(row, field) || siblings.has(row.Key) || selected.size && !selected.has(row.Key)) return false
      if (!totals(row, columns) || !Array.isArray(row.Children) || ++count > 2_000_000) return false
      if ((row.Values as CashMovementsValues).СуммаОборот === null) return false
      siblings.add(row.Key)
      if (depth === 3 ? row.Children.length !== 0 : !row.Children.length || !level(row.Children, depth + 1)) return false
    }
    return true
  }
  return level(v, 0)
}
export function normalizeCashMovements(v: unknown, request: CashMovementsRequest): CashMovementsResult {
  const fail = () => { throw new Error('Сервер не підтвердив повні рухи коштів для поточного періоду та всіх відборів.') }
  if (!identity(request) || statementPeriodError(request.From, request.Through) || !object(v) || !commonResult(v, request)) return fail()
  if (!v.Available) { if (!unavailable(v)) return fail(); return structuredClone(v) as CashMovementsResult }
  if (!digest(v.InputWitnessSha256) || !digest(v.ResultSha256) || v.Dependency !== null || !managementCurrency(v.ManagementCurrency)) return fail()
  const rows = v.Rows as unknown[], columns = (v.Columns as CashMovementsChoice[]).map(c => c.Key), selectedKinds = new Set(request.MoneyKinds), grand = v.Totals
  if (columns.some(key => selectedKinds.size && !selectedKinds.has(key)) || !totals(grand, columns) || !hierarchy(rows, columns, request)) return fail()
  if (rows.length === 0) {
    if (v.Code !== 'original_cash_movements_empty' || columns.length || grand.Values.СуммаОборот !== null) return fail()
  } else if (v.Code !== 'original_cash_movements_available' || !columns.length || grand.Values.СуммаОборот === null) return fail()
  return structuredClone(v) as CashMovementsResult
}
export function isCashMovementsCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:ДвиженияДенежныхСредств' && worlds.includes('fenix')
    && report.Sources.some(source => source.World === 'fenix' && source.SourceId === CASH_MOVEMENTS_SOURCE && source.DefinitionSha256 === CASH_MOVEMENTS_DEFINITION)
}
