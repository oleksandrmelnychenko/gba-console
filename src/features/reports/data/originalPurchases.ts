import type { ReportCatalogueEntry } from '../types'
import { statementPeriodError } from './originalCounterpartyStatement'

export const PURCHASES_SOURCE = 'ed77c5cc-6688-4316-a631-2ad0b237140d'
export const PURCHASES_DEFINITION = '582aeeaf58b04b2234f9b73c3036045882b47d94165b3e47d70529b44520b241'
export const purchasesRows = ['СтатусПартии', 'Контрагент', 'Номенклатура'] as const
export const purchasesFilters = [...purchasesRows, 'Подразделение', 'Проект'] as const
export const purchasesMeasures = ['КоличествоОборот', 'КоличествоЕдиницОтчетов', 'КоличествоБазовыхЕд', 'СтоимостьОборот', 'НДСОборот', 'ВесОборот'] as const
export const purchasesDefaultMeasures = ['КоличествоБазовыхЕд', 'СтоимостьОборот', 'НДСОборот', 'ВесОборот'] as const
export const PURCHASES_BASE_UNIT_FIELD = 'НоменклатураБазоваяЕдиницаИзмерения'
export const purchasesDefaultAdditionalFieldSettings = [{ Field: PURCHASES_BASE_UNIT_FIELD, Dimension: 'Номенклатура', Use: true,
  Placement: 'ВместеСИзмерениями', Position: 'После группировки', Header: 'Базовая единица измерения' }] as const
export type PurchasesAdditionalFieldSetting = typeof purchasesDefaultAdditionalFieldSettings[number]
export type PurchasesBaseUnit = {
  Field: typeof PURCHASES_BASE_UNIT_FIELD; Type: '08'; TableReference: '0000003D'; Key: string | null; Caption: string | null; CaptionAvailable: boolean;
  Code: 'base_product_publication_unavailable' | 'base_product_row_missing' | 'base_unit_link_null' | 'base_unit_reference_empty'
    | 'base_unit_publication_unavailable' | 'base_unit_row_missing' | 'base_unit_caption_empty' | 'base_unit_description_observed';
  Deleted: boolean | null; NativePresentationVerified: false; SourceParityVerified: false
}
export type PurchasesMeasure = typeof purchasesMeasures[number]
export type PurchasesField = typeof purchasesFilters[number]
const purchaseFilterSet = new Set<PurchasesField>(purchasesFilters)
export const purchasesLabels: Record<PurchasesMeasure, string> = {
  КоличествоОборот: 'Кількість за регістром', КоличествоЕдиницОтчетов: 'Кількість у звітних одиницях', КоличествоБазовыхЕд: 'Кількість у базових одиницях',
  СтоимостьОборот: 'Вартість', НДСОборот: 'ПДВ', ВесОборот: 'Вага',
}
export const purchasesFilterLabels: Record<PurchasesField, string> = {
  СтатусПартии: 'Статуси партій', Контрагент: 'Контрагенти', Номенклатура: 'Номенклатура', Подразделение: 'Підрозділи', Проект: 'Проєкти',
}
type PurchasesIdentity = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string }
export type PurchasesPolicies = {
  DatePolicy: 'DeclaredInclusiveBusinessDaysThroughLastWholeSecond';
  QuantityPolicy: 'SignedStoredPurchasesQuantityWithObservedProductOwnedUnitCoefficients';
  ZeroRowPolicy: 'RetainContributingNormalRowsIncludingCancellationNativeVirtualSuppressionUnverified';
  HumanChoicesAvailable: false; AppliesFxConversion: false; NativeDateParametersVerified: false;
  NativeVirtualRegistrarTotalsVerified: false; NativeZeroGroupSuppressionVerified: false;
  NativeNullNumericSemanticsVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false
}
export type PurchasesCapability = PurchasesIdentity & PurchasesPolicies & {
  ModuleSha256: string; UniversalReportModuleSha256: string; RegisterUuid: string;
  QueryPolicy: 'OwnRegisterUniversalReportDynamicTurnoversRegistrarPeriodicity'; DefaultScopeCode: 'original_purchases_declared_calendar_v1';
  Executable: boolean; SourceSyncEnabled: false; NormalInputsReadinessVerified: false;
  DefaultRows: string[]; DefaultColumns: string[]; Filters: string[]; Measures: string[]; DefaultMeasures: string[];
  DefaultAdditionalFields: string[]; DefaultAdditionalFieldSettings: PurchasesAdditionalFieldSetting[]
}
export type PurchasesRequest = PurchasesIdentity & {
  From: string; Through: string; Statuses: string[]; Counterparties: string[]; Products: string[]; Divisions: string[]; Projects: string[]; Measures: PurchasesMeasure[];
  NamedChoiceWitnesses?: Partial<Record<PurchasesField, string>> | null
}
export type PurchasesValues = Record<string, string>
export type PurchasesRow = { Field: typeof purchasesRows[number]; Key: string; Caption: string; CaptionAvailable: boolean; Values: PurchasesValues; Children: PurchasesRow[];
  AdditionalFields?: Record<typeof PURCHASES_BASE_UNIT_FIELD, PurchasesBaseUnit> | null }
export type PurchasesResult = PurchasesIdentity & PurchasesPolicies & {
  From: string; Through: string; Selectors: Record<PurchasesField, string[]>; Measures: PurchasesMeasure[];
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: true;
  InputWitnessSha256: string | null; ResultSha256: string | null; Rows: PurchasesRow[]; Totals: PurchasesValues | null;
  Dependency: null | { Kind: string; MissingMonth: string | null; Product: string | null };
  NamedChoiceWitnesses?: Partial<Record<PurchasesField, string>> | null;
  NamedFieldAvailability?: Record<PurchasesField, boolean> | null;
  AdditionalFieldSettings: PurchasesAdditionalFieldSetting[]; BaseMeasurementUnitWitnessSha256: string | null
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const ref = (value: unknown): value is string => typeof value === 'string' && /^[0-9A-F]{32}$/.test(value)
const project = (value: unknown): value is string => typeof value === 'string' && /^[0-9A-F]{2}:[0-9A-F]{8}:[0-9A-F]{32}$/.test(value)
const digest = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) && !/^0+$/.test(value)
const exact = (value: unknown, expected: readonly string[]) => Array.isArray(value) && value.length === expected.length && value.every((x, i) => x === expected[i])
const identity = (value: Record<string, unknown>) => value.Version === 1 && value.World === 'fenix' && value.SourceId === PURCHASES_SOURCE && value.DefinitionSha256 === PURCHASES_DEFINITION
const additionalSettings = (value: unknown) => Array.isArray(value) && value.length === 1 && object(value[0])
  && exact(Object.keys(value[0]).sort(), Object.keys(purchasesDefaultAdditionalFieldSettings[0]).sort())
  && Object.entries(purchasesDefaultAdditionalFieldSettings[0]).every(([key, expected]) => value[0][key] === expected)
const policies = (value: Record<string, unknown>) => value.DatePolicy === 'DeclaredInclusiveBusinessDaysThroughLastWholeSecond'
  && value.QuantityPolicy === 'SignedStoredPurchasesQuantityWithObservedProductOwnedUnitCoefficients'
  && value.ZeroRowPolicy === 'RetainContributingNormalRowsIncludingCancellationNativeVirtualSuppressionUnverified'
  && value.HumanChoicesAvailable === false && value.AppliesFxConversion === false && value.NativeDateParametersVerified === false
  && value.NativeVirtualRegistrarTotalsVerified === false && value.NativeZeroGroupSuppressionVerified === false
  && value.NativeNullNumericSemanticsVerified === false && value.SourceParityVerified === false && value.OriginalFullTaskAccepted === false
export function isPurchasesCapability(value: unknown): value is PurchasesCapability {
  return object(value) && identity(value) && policies(value)
    && value.ModuleSha256 === '01f65a3bdf8e7768e5c91619196a6fb1c0afe1da04b2e6b569b7a4449376d37a'
    && value.UniversalReportModuleSha256 === 'c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17'
    && value.RegisterUuid === '7a7763d1-6dbb-4f9d-abc7-75a12ad42db3' && typeof value.Executable === 'boolean'
    && value.QueryPolicy === 'OwnRegisterUniversalReportDynamicTurnoversRegistrarPeriodicity'
    && value.DefaultScopeCode === 'original_purchases_declared_calendar_v1' && value.SourceSyncEnabled === false && value.NormalInputsReadinessVerified === false
    && exact(value.DefaultRows, purchasesRows) && exact(value.DefaultColumns, []) && exact(value.Filters, purchasesFilters)
    && exact(value.Measures, purchasesMeasures) && exact(value.DefaultMeasures, purchasesDefaultMeasures)
    && exact(value.DefaultAdditionalFields, [PURCHASES_BASE_UNIT_FIELD]) && additionalSettings(value.DefaultAdditionalFieldSettings)
}
export { statementPeriodError as purchasesPeriodError }
const witnesses = (value: unknown): value is Partial<Record<PurchasesField, string>> => object(value) && Object.keys(value).length <= 5
  && Object.entries(value).every(([field, hash]) => purchaseFilterSet.has(field as PurchasesField) && digest(hash))
export const isPurchasesHumanCaption = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= 100 && !/[\p{Cc}]/u.test(value) && !ref(value) && !project(value)
export function validatePurchasesRequest(value: PurchasesRequest): PurchasesRequest {
  const arrays = [value?.Statuses, value?.Counterparties, value?.Products, value?.Divisions, value?.Projects]
  if (!object(value) || !identity(value) || typeof value.From !== 'string' || typeof value.Through !== 'string' || statementPeriodError(value.From, value.Through)
    || arrays.some((keys, index) => !Array.isArray(keys) || keys.length > 256 || !keys.every(index === 4 ? project : ref) || new Set(keys).size !== keys.length)
    || !Array.isArray(value.Measures) || !value.Measures.length || value.Measures.length > purchasesMeasures.length
    || !value.Measures.every(m => purchasesMeasures.includes(m)) || new Set(value.Measures).size !== value.Measures.length
    || value.NamedChoiceWitnesses != null && !witnesses(value.NamedChoiceWitnesses)) throw new Error('Некоректний запит оригінального звіту «Закупки».')
  return { Version: 1, World: 'fenix', SourceId: PURCHASES_SOURCE, DefinitionSha256: PURCHASES_DEFINITION,
    From: value.From, Through: value.Through, Statuses: [...value.Statuses].sort(), Counterparties: [...value.Counterparties].sort(),
    Products: [...value.Products].sort(), Divisions: [...value.Divisions].sort(), Projects: [...value.Projects].sort(),
    Measures: purchasesMeasures.filter(m => value.Measures.includes(m)),
    ...(value.NamedChoiceWitnesses != null ? { NamedChoiceWitnesses: { ...value.NamedChoiceWitnesses } } : {}) }
}
export function purchasesRequest(capability: PurchasesCapability, from: string, through: string, measures: readonly PurchasesMeasure[] = purchasesDefaultMeasures): PurchasesRequest {
  if (!isPurchasesCapability(capability) || !capability.Executable) throw new Error('Формування оригінального звіту «Закупки» недоступне.')
  return validatePurchasesRequest({ Version: 1, World: 'fenix', SourceId: PURCHASES_SOURCE, DefinitionSha256: PURCHASES_DEFINITION,
    From: from, Through: through, Statuses: [], Counterparties: [], Products: [], Divisions: [], Projects: [], Measures: [...measures] })
}
export const purchasesSelectors = (request: PurchasesRequest): Record<PurchasesField, string[]> => ({
  СтатусПартии: request.Statuses, Контрагент: request.Counterparties, Номенклатура: request.Products, Подразделение: request.Divisions, Проект: request.Projects,
})
/** Used only for canonical signed-string validation. The client never aggregates rounded hierarchy cells. */
export function purchasesMilli(value: unknown): bigint {
  if (typeof value !== 'string' || value.length > 400 || !/^-?(0|[1-9]\d*)\.\d{3}$/.test(value) || value === '-0.000') throw new Error('Некоректна точна кількість закупівель.')
  return BigInt(value.replace('.', ''))
}
/** Stored cost and VAT have two decimal places; quantities and weight have three. */
export function purchasesScaled(value: unknown, measure: PurchasesMeasure): bigint {
  if (measure !== 'СтоимостьОборот' && measure !== 'НДСОборот') return purchasesMilli(value)
  if (typeof value !== 'string' || value.length > 400 || !/^-?(0|[1-9]\d*)\.\d{2}$/.test(value) || value === '-0.00') throw new Error('Некоректна точна сума закупівель.')
  return BigInt(value.replace('.', ''))
}
const values = (value: unknown, measures: readonly PurchasesMeasure[]): value is PurchasesValues => object(value)
  && exact(Object.keys(value).sort(), [...measures].sort()) && measures.every(m => { purchasesScaled(value[m], m); return true })
function baseUnit(value: unknown, witness: unknown): value is PurchasesBaseUnit {
  if (!object(value) || value.Field !== PURCHASES_BASE_UNIT_FIELD || value.Type !== '08' || value.TableReference !== '0000003D'
    || value.NativePresentationVerified !== false || value.SourceParityVerified !== false
    || typeof value.CaptionAvailable !== 'boolean' || !(value.Deleted === null || typeof value.Deleted === 'boolean')) return false
  if (value.Code === 'base_product_publication_unavailable') return witness === null && value.Key === null && value.Caption === null && !value.CaptionAvailable && value.Deleted === null
  if (!digest(witness)) return false
  if (value.Code === 'base_product_row_missing' || value.Code === 'base_unit_link_null') return value.Key === null && value.Caption === null && !value.CaptionAvailable && value.Deleted === null
  if (value.Code === 'base_unit_reference_empty') return value.Key === '0'.repeat(32) && value.Caption === null && !value.CaptionAvailable && value.Deleted === null
  if (!ref(value.Key) || /^0+$/.test(value.Key)) return false
  if (value.Code === 'base_unit_publication_unavailable' || value.Code === 'base_unit_row_missing') return value.Caption === null && !value.CaptionAvailable && value.Deleted === null
  if (value.Code === 'base_unit_caption_empty') return value.Caption === null && !value.CaptionAvailable && typeof value.Deleted === 'boolean'
  return value.Code === 'base_unit_description_observed' && value.CaptionAvailable && isPurchasesHumanCaption(value.Caption)
    && value.Caption.length <= 45 && typeof value.Deleted === 'boolean'
}
function dependency(value: unknown): value is NonNullable<PurchasesResult['Dependency']> {
  return object(value) && typeof value.Kind === 'string' && /^[a-z_]+$/.test(value.Kind)
    && (value.MissingMonth === null || typeof value.MissingMonth === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value.MissingMonth))
    && (value.Product === null || ref(value.Product))
}
function namedEvidence(value: Record<string, unknown>): boolean {
  if (value.NamedChoiceWitnesses == null && value.NamedFieldAvailability == null) return true
  const availability = value.NamedFieldAvailability, current = value.NamedChoiceWitnesses
  return object(availability) && exact(Object.keys(availability).sort(), [...purchasesFilters].sort())
    && purchasesFilters.every(field => typeof availability[field] === 'boolean') && availability.СтатусПартии === false && witnesses(current)
    && exact(Object.keys(current).sort(), purchasesFilters.filter(field => availability[field]).sort())
}
/** Validates the exact echoed scope, hierarchy and policies before rendering or exporting a detached completed result. */
export function normalizePurchases(value: unknown, request: PurchasesRequest): PurchasesResult {
  const scope = validatePurchasesRequest(request), selectors = purchasesSelectors(scope)
  const fail = () => { throw new Error('Сервер не підтвердив повні закупівлі для поточних параметрів.') }
  if (!object(value) || !identity(value) || !policies(value) || value.From !== scope.From || value.Through !== scope.Through
    || !object(value.Selectors) || !exact(Object.keys(value.Selectors).sort(), [...purchasesFilters].sort())
    || !purchasesFilters.every(field => exact((value.Selectors as Record<string, unknown>)[field], selectors[field]))
    || !exact(value.Measures, scope.Measures) || typeof value.Available !== 'boolean' || value.NormalInputsComplete !== value.Available
    || value.OurSnapshotVerified !== true || !Array.isArray(value.Rows)) return fail()
  if (!value.Available) {
    if (value.Rows.length || value.Totals !== null || value.InputWitnessSha256 !== null || value.ResultSha256 !== null
      || !dependency(value.Dependency) || value.Code !== `original_purchases_${value.Dependency.Kind}`
      || !exact(value.AdditionalFieldSettings, []) || value.BaseMeasurementUnitWitnessSha256 !== null) return fail()
    return structuredClone(value) as PurchasesResult
  }
  if (value.Code !== (value.Rows.length ? 'original_purchases_declared_calendar_complete' : 'original_purchases_declared_calendar_empty')
    || value.Dependency !== null || !digest(value.InputWitnessSha256) || !digest(value.ResultSha256) || !values(value.Totals, scope.Measures) || !namedEvidence(value)
    || !additionalSettings(value.AdditionalFieldSettings) || !(value.BaseMeasurementUnitWitnessSha256 === null || digest(value.BaseMeasurementUnitWitnessSha256))) return fail()
  const availability = value.NamedFieldAvailability as Record<PurchasesField, boolean> | null | undefined
  const current = value.NamedChoiceWitnesses as Partial<Record<PurchasesField, string>> | null | undefined
  const baseUnitWitness = value.BaseMeasurementUnitWitnessSha256
  if (!purchasesFilters.every(field => !selectors[field].length || availability?.[field] === true
    && current?.[field] === scope.NamedChoiceWitnesses?.[field] && digest(current?.[field]))) return fail()
  const selectedKeys = purchasesRows.map(field => new Set(selectors[field]))
  let leaves = 0, count = 0
  function rows(input: unknown[], depth: number): boolean {
    const keys = new Set<string>(), field = purchasesRows[depth]
    return input.every(row => {
      if (!object(row) || row.Field !== field || !ref(row.Key) || keys.has(row.Key) || selectors[field].length && !selectedKeys[depth].has(row.Key)
        || typeof row.CaptionAvailable !== 'boolean' || selectors[field].length > 0 && !row.CaptionAvailable || (row.CaptionAvailable
          ? availability?.[field] !== true || !isPurchasesHumanCaption(row.Caption) : row.Caption !== 'Назва недоступна') || !values(row.Values, scope.Measures)
        || !Array.isArray(row.Children) || ++count > 1_500_000) return false
      const children = row.Children
      keys.add(row.Key)
      if (depth === 2) return children.length === 0 && ++leaves <= 500_000 && object(row.AdditionalFields)
        && exact(Object.keys(row.AdditionalFields), [PURCHASES_BASE_UNIT_FIELD]) && baseUnit(row.AdditionalFields[PURCHASES_BASE_UNIT_FIELD], baseUnitWitness)
      return row.AdditionalFields == null && children.length > 0 && rows(children, depth + 1)
    })
  }
  if (!rows(value.Rows, 0)) return fail()
  if (!value.Rows.length && scope.Measures.some(m => purchasesScaled((value.Totals as PurchasesValues)[m], m) !== 0n)) return fail()
  return structuredClone(value) as PurchasesResult
}
export function purchasesResultRequest(result: PurchasesResult): PurchasesRequest {
  return validatePurchasesRequest({ Version: result.Version, World: result.World, SourceId: result.SourceId, DefinitionSha256: result.DefinitionSha256,
    From: result.From, Through: result.Through, Statuses: result.Selectors.СтатусПартии, Counterparties: result.Selectors.Контрагент,
    Products: result.Selectors.Номенклатура, Divisions: result.Selectors.Подразделение, Projects: result.Selectors.Проект, Measures: result.Measures,
    ...(result.NamedChoiceWitnesses != null ? { NamedChoiceWitnesses: result.NamedChoiceWitnesses } : {}) })
}
export function isPurchasesCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:Закупки' && worlds.includes('fenix')
    && report.Sources.some(source => source.World === 'fenix' && source.SourceId === PURCHASES_SOURCE && source.DefinitionSha256 === PURCHASES_DEFINITION)
}
