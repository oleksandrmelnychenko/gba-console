import type { OneCTurnoverFilters, ReportDataset, ReportRequestBody } from '../types'
import { oneCReportPeriodError, EXACT_ONE_C_BUYER_ROOT_ID } from './oneCTurnoverReport'

export const PRICE_TYPE_SALES_COMPARISON_SOURCE = 27
export const PRICE_TYPE_SALES_COMPARISON_TITLE = '1С: Продажі (порівняння за типом цін)'
export const PRICE_TYPE_SALES_COMPARISON_LOOKUP_FIELD = 46
export const PRICE_TYPE_SALES_COMPARISON_FILTERS = [51, 52, 45, 53, 54] as const
export const PRICE_TYPE_SALES_COMPARISON_DEFAULT_ROWS = [12, 5] as const
export const PRICE_TYPE_SALES_COMPARISON_DEFAULT_MEASURES = [4, 70, 71] as const

export type PriceTypeSalesComparisonOptions = {
  Version: 1
  SourceWorld: 1
  PriceTypeId: string
  SalesBasis?: 0 | 1 | null
}

export type PriceTypeSalesComparisonCapabilities = {
  Version: 1
  SourceWorlds: [1]
  PriceTypeIdFormat: '32 hexadecimal characters (16 bytes)'
  RequiresPriceTypeId: true
  PriceTypeLookupField: 46
  DefaultRowGroupings: [12, 5]
  DefaultMeasurements: [4, 70, 71]
  PriceSelection: 'DailyLatestExactPriceThenSourceOuterJoinWithoutDay'
  Aggregation: 'SourceTurnoverSum; discount percent recomputed from aggregated before-discount and net values'
  ExactAgreementPreserved: true
  RecommendationEligible: false
  AgreementPriceFallback: false
  CoverageStatus: 'native_partial'
  ParityVerified: false
  MaximumGroupedRows: 500000
  SalesBases?: [0, 1]
  NewDraftSalesBasis?: 0
  OperationalRequiresDailyTurnoverPublication?: false
  OperationalGroupings?: [0, 1, 2, 3, 4, 5, 6, 12, 15]
  OperationalLookupFields?: [51, 52, 45]
  OperationalScopePath?: '/report/datasets/27/current-scope'
}

type JsonRecord = Record<string, unknown>

const SETTINGS_FIELDS = ['Version', 'SourceWorld', 'PriceTypeId'] as const
const SOURCE_REFERENCE = /^[0-9a-f]{32}$/i
const ZERO_REFERENCE = /^0{32}$/
const INVALID = 'Перевірте exact scope Fenix, глобальний тип ціни, структуру та точні відбори порівняння продажів. Налаштування не застосовано.'
const GROUPINGS = new Set([0, 1, 2, 3, 4, 5, 6, 12, 15, 22, 23, 63, 64, 65, 66, 67])
const MEASURES = new Set([0, 2, 3, 4, 67, 68, 69, 70, 71])

const record = (value: unknown): value is JsonRecord => value !== null && typeof value === 'object' && !Array.isArray(value)
const aliases = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())

export function priceTypeSalesSourceId(value: unknown): string | null {
  return typeof value === 'string' && SOURCE_REFERENCE.test(value) && !ZERO_REFERENCE.test(value)
    ? value.toUpperCase()
    : null
}

export function defaultPriceTypeSalesComparison(capability?: unknown): PriceTypeSalesComparisonOptions {
  return { Version: 1, SourceWorld: 1, PriceTypeId: '', ...(hasCurrentPriceTypeSalesChoices(capability) ? { SalesBasis: 0 as const } : {}) }
}

export function priceTypeSalesBasis(raw: unknown): 0 | 1 {
  if (!record(raw)) return 1
  const keys = aliases(raw, 'SalesBasis')
  return keys.length === 1 && raw[keys[0]] === 0 ? 0 : 1
}

const OPERATIONAL = {
  SalesBases: [0, 1], NewDraftSalesBasis: 0,
  OperationalRequiresDailyTurnoverPublication: false,
  OperationalGroupings: [0, 1, 2, 3, 4, 5, 6, 12, 15],
}
const CURRENT_CHOICES = { OperationalLookupFields: [51, 52, 45], OperationalScopePath: '/report/datasets/27/current-scope' }
const matches = (raw: JsonRecord, expected: JsonRecord) => Object.entries(expected)
  .every(([key, value]) => JSON.stringify(raw[key]) === JSON.stringify(value))

export function hasOperationalPriceTypeSales(capability: unknown): boolean {
  return record(capability) && matches(capability, OPERATIONAL)
}

export function hasCurrentPriceTypeSalesChoices(capability: unknown): boolean {
  return hasOperationalPriceTypeSales(capability) && record(capability) && matches(capability, CURRENT_CHOICES)
}

export function currentPriceTypeSalesLookupBasis(dataSource: number, settings: unknown, capability: unknown): 0 | undefined {
  return dataSource === 27 && priceTypeSalesBasis(settings) === 0 && hasCurrentPriceTypeSalesChoices(capability) ? 0 : undefined
}

const OPERATIONAL_CAPTIONS: Record<number, string> = {
  0: 'Кількість продажів мінус повернення (GBA)', 2: 'Продажі без ПДВ, EUR', 3: 'ПДВ продажів, EUR',
  4: 'Продажі з ПДВ, EUR', 67: 'Продажі до знижки без ПДВ, EUR', 68: 'Знижка без ПДВ, EUR',
  69: 'Знижка без ПДВ, %', 70: 'Сума за глобальним типом цін, EUR', 71: 'Різниця із сумою за типом цін, EUR',
}

export function priceTypeSalesFormDataset(dataset: ReportDataset | undefined, settings: unknown): ReportDataset | undefined {
  if (dataset?.DataSource !== 27 || priceTypeSalesBasis(settings) !== 0) return dataset
  return { ...dataset, Groupings: dataset.Groupings.filter(field => OPERATIONAL.OperationalGroupings.includes(field.Type)),
    Filters: dataset.Filters.filter(field => CURRENT_CHOICES.OperationalLookupFields.includes(field.Type)),
    Measurements: dataset.Measurements.map(field => ({ ...field, Name: OPERATIONAL_CAPTIONS[field.Type] ?? field.Name })) }
}

export function requestPriceTypeSalesComparison(data: object): unknown {
  const key = aliases(data, 'PriceTypeSalesComparison')[0]
  return key === undefined ? undefined : (data as JsonRecord)[key]
}

export function clonePriceTypeSalesComparisonAliases(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) =>
    key.toLowerCase() === 'pricetypesalescomparison' ? [[key, structuredClone(value)]] : []))
}

export function clonePriceTypeSalesComparisonValue(data: ReportRequestBody): unknown {
  const raw = requestPriceTypeSalesComparison(data)
  return structuredClone(priceTypeSalesComparisonOptions(raw) ?? raw)
}

export function priceTypeSalesComparisonOptions(raw: unknown): PriceTypeSalesComparisonOptions | null {
  if (!record(raw) || Object.keys(raw).some(key => ![...SETTINGS_FIELDS, 'SalesBasis'].some(field => field.toLowerCase() === key.toLowerCase()))) return null
  const normalized: JsonRecord = {}
  for (const field of SETTINGS_FIELDS) {
    const keys = aliases(raw, field)
    if (keys.length !== 1) return null
    normalized[field] = raw[keys[0]]
  }
  const basisKeys = aliases(raw, 'SalesBasis')
  if (basisKeys.length > 1 || basisKeys.length === 1 && ![null, 0, 1].includes(raw[basisKeys[0]] as null | number)) return null
  const priceTypeId = priceTypeSalesSourceId(normalized.PriceTypeId)
  return normalized.Version === 1 && normalized.SourceWorld === 1 && priceTypeId
    ? { Version: 1, SourceWorld: 1, PriceTypeId: priceTypeId,
      ...(basisKeys.length ? { SalesBasis: raw[basisKeys[0]] as 0 | 1 | null } : {}) }
    : null
}

export function isPriceTypeSalesComparisonCapability(raw: unknown): raw is PriceTypeSalesComparisonCapabilities {
  if (!record(raw)) return false
  const expected: PriceTypeSalesComparisonCapabilities = {
    Version: 1,
    SourceWorlds: [1],
    PriceTypeIdFormat: '32 hexadecimal characters (16 bytes)',
    RequiresPriceTypeId: true,
    PriceTypeLookupField: 46,
    DefaultRowGroupings: [12, 5],
    DefaultMeasurements: [4, 70, 71],
    PriceSelection: 'DailyLatestExactPriceThenSourceOuterJoinWithoutDay',
    Aggregation: 'SourceTurnoverSum; discount percent recomputed from aggregated before-discount and net values',
    ExactAgreementPreserved: true,
    RecommendationEligible: false,
    AgreementPriceFallback: false,
    CoverageStatus: 'native_partial',
    ParityVerified: false,
    MaximumGroupedRows: 500000,
  }
  const extras = Object.keys(raw).filter(key => !(key in expected))
  return matches(raw, expected) && (extras.length === 0
    || extras.length === Object.keys(OPERATIONAL).length && matches(raw, OPERATIONAL)
      && extras.every(key => key in OPERATIONAL)
    || extras.length === Object.keys(OPERATIONAL).length + Object.keys(CURRENT_CHOICES).length
      && matches(raw, OPERATIONAL) && matches(raw, CURRENT_CHOICES)
      && extras.every(key => key in OPERATIONAL || key in CURRENT_CHOICES))
}

export function normalizePriceTypeSalesComparisonDataset(value: JsonRecord): ReportDataset | null {
  const keys = aliases(value, 'PriceTypeSalesComparison')
  if (keys.length > 1) return null
  const capability = keys.length ? value[keys[0]] : undefined
  if (value.DataSource === PRICE_TYPE_SALES_COMPARISON_SOURCE) {
    if (!isPriceTypeSalesComparisonCapability(capability)) return null
  } else if (capability != null) {
    return null
  }
  const normalized = { ...value }
  for (const key of keys) delete normalized[key]
  if (capability != null) normalized.priceTypeSalesComparison = structuredClone(capability)
  return normalized as ReportDataset
}

export function isPriceTypeSalesComparisonDataset(dataset: ReportDataset): boolean {
  const exactTypes = (key: 'Groupings' | 'Measurements' | 'Filters', expected: readonly number[]) =>
    dataset[key].length === expected.length
      && dataset[key].every((field, index) => field.Type === expected[index] && field.Selectable !== false)
  return dataset.DataSource === PRICE_TYPE_SALES_COMPARISON_SOURCE
    && dataset.PeriodRequired === true && dataset.PeriodSupported === true
    && isPriceTypeSalesComparisonCapability(dataset.priceTypeSalesComparison)
    && exactTypes('Groupings', [0, 1, 2, 3, 4, 5, 6, 12, 15, 22, 23, 63, 64, 65, 66, 67])
    && exactTypes('Measurements', [0, 2, 3, 4, 67, 68, 69, 70, 71])
    && exactTypes('Filters', PRICE_TYPE_SALES_COMPARISON_FILTERS)
    && ['Ordering', 'FilterExpression', 'TopGroups', 'Threshold', 'HideZero', 'AbcClassification']
      .every(key => (dataset as unknown as JsonRecord)[key] == null)
}

function isPriceTypeScope(value: unknown): value is OneCTurnoverFilters {
  if (!record(value) || Object.keys(value).some(key => !['OrganizationIds', 'ProductKindId', 'ExcludeServices', 'BuyerRootId'].includes(key))) return false
  return Array.isArray(value.OrganizationIds) && value.OrganizationIds.length > 0 && value.OrganizationIds.length <= 100
    && value.OrganizationIds.every(id => priceTypeSalesSourceId(id) !== null)
    && new Set(value.OrganizationIds.map(id => id.toUpperCase())).size === value.OrganizationIds.length
    && priceTypeSalesSourceId(value.ProductKindId) !== null
    && typeof value.ExcludeServices === 'boolean'
    && typeof value.BuyerRootId === 'string'
    && value.BuyerRootId.toUpperCase() === EXACT_ONE_C_BUYER_ROOT_ID
}

function selectionError(data: ReportRequestBody): string | null {
  if (!Array.isArray(data.selections) || data.selections.length > 64) return INVALID
  let values = 0
  for (const selection of data.selections) {
    if (!selection || (selection.IsChecked != null && typeof selection.IsChecked !== 'boolean') || !Array.isArray(selection.Values)) return INVALID
    values += selection.Values.length
    if (values > 2000) return 'Порівняння продажів підтримує до 2 000 точних значень у відборах.'
    if (selection.IsChecked === false) continue
    if (!PRICE_TYPE_SALES_COMPARISON_FILTERS.some(field => field === selection.SelectedField?.Type)
      || ![0, 1, 2, 4].includes(selection.FilterCondition?.Type) || !selection.Values.length
      || selection.Values.some(value => priceTypeSalesSourceId(value?.Data?.Id) === null)) return INVALID
  }
  return null
}

export function priceTypeSalesComparisonConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = aliases(data, 'PriceTypeSalesComparison')
  if (keys.length > 1) return 'Параметри порівняння продажів за типом цін задані двічі. Налаштування не застосовано.'
  const settings = requestPriceTypeSalesComparison(data)
  if (data.dataSource !== PRICE_TYPE_SALES_COMPARISON_SOURCE) return settings != null
    ? 'Глобальний тип ціни підтримує лише звіт «1С: Продажі (порівняння за типом цін)».'
    : null
  const options = priceTypeSalesComparisonOptions(settings)
  if (!options) return 'Оберіть точний глобальний тип ціни Fenix.'
  if (!isPriceTypeScope(data.oneC)) return options.SalesBasis === 0
    ? 'Оберіть організації та вид товару поточних продажів із групою покупців.'
    : 'Оберіть доступне локальне покриття Fenix із точним коренем групи покупців.'
  if (oneCReportPeriodError(data.from, data.to)) return 'Оберіть коректний період Fenix від 1 до 366 днів.'
  if (dataset && !isPriceTypeSalesComparisonCapability(dataset.priceTypeSalesComparison)) {
    return 'Сервер не підтвердив можливості порівняння продажів за глобальним типом цін.'
  }
  if (options.SalesBasis === 0 && dataset && !hasOperationalPriceTypeSales(dataset.priceTypeSalesComparison))
    return 'Сервер ще не підтримує основу поточних продажів.'
  const unsupported = new Set(['valuationclientagreementid', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare',
    'returncomparison', 'ratecomparison', 'margincomparison', 'paymentcomparison', 'ordering', 'filterexpression',
    'topgroups', 'threshold', 'hidezero', 'abcclassification', 'productclassification', 'sourceorganizations'])
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return INVALID
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col)
    || !Array.isArray(data.sorted.Measurements) || !data.sorted.Row.length) return INVALID
  const axes = [...data.sorted.Row, ...data.sorted.Col]
  if (options.SalesBasis === 0) {
    if (axes.some(field => !OPERATIONAL.OperationalGroupings.includes(field?.type)))
      return 'Поточні продажі підтримують дату, організацію, покупця, договір, товар та артикул.'
    if (Array.isArray(data.selections) && data.selections.some(selection => selection?.IsChecked !== false && [53, 54].includes(selection?.SelectedField?.Type)))
      return 'Для поточних продажів відбір проєкту й підрозділу ще недоступний.'
  }
  if (axes.some(item => !item || !GROUPINGS.has(item.type))
    || new Set(axes.map(item => item.type)).size !== axes.length) return INVALID
  const measures = data.sorted.Measurements
  const active = measures.filter(item => item?.IsChecked !== false)
  if (!measures.length || measures.length > MEASURES.size || !active.length
    || measures.some(item => !item || !MEASURES.has(item.Type)
      || (item.IsChecked != null && typeof item.IsChecked !== 'boolean'))
    || new Set(measures.map(item => item.Type)).size !== measures.length) return INVALID
  return selectionError(data)
}
