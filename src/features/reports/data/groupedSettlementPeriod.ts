import { workbookConfigurationError } from './workbookPresentation'
import type { ReportDataset, ReportFilterExpressionCapabilities, ReportGroupingItem, ReportRequestBody, ReportSourceBuyerSubtree } from '../types'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { EXACT_ONE_C_BUYER_ROOT_ID } from './oneCTurnoverReport'
import { readFilterExpressionCapabilities, reportFilterExpressionError } from './reportFilterExpression'
import { revenueExactId } from './revenueComparison'
import { settlementAttributeKey } from './settlementSourceAttributes'
import { previousKyivDay } from './cashPeriod'
import { sourceCounterpartyGroupsConfigurationError } from './sourceCounterpartyGroups'

type JsonRecord = Record<string, unknown>
const record = (value: unknown): value is JsonRecord => value !== null && typeof value === 'object' && !Array.isArray(value)
const aliases = (value: object, key: string) => Object.keys(value).filter(name => name.toLowerCase() === key.toLowerCase())
const exact = (value: unknown, expected: readonly number[]) => Array.isArray(value)
  && value.length === expected.length && value.every((item, index) => item === expected[index])
const capabilityFields = ['Version', 'MaximumDays', 'CurrencyBasis', 'UsesCurrentNativeBuyerAgreements',
  'PreservesUnavailableValues', 'RequiresCommonSourceObservation', 'CurrentDaySupported', 'SourceWorlds',
  'RowLayouts', 'Measurements', 'Filters', 'FilterExpression', 'BuyerSubtree'] as const
export const GROUPED_SETTLEMENT_LAYOUTS = [[4, 41, 76], [4, 76]] as const
export const GROUPED_SETTLEMENT_FILTERS = [0, 6, 9, 30] as const
export const GROUPED_SETTLEMENT_SUPPLIER_FILTERS = [0, 6, 9, 17, 18, 30] as const
export const GROUPED_SETTLEMENT_MEASURES = [88, 89, 90, 91] as const
export type GroupedSettlementPeriod = { Version: 1; SourceWorld: 'Fenix' | 'Amg'; CurrencyBasis: 'SettlementCurrency' }
export type GroupedSettlementCapability = {
  Version: 1; MaximumDays: 31; CurrencyBasis: 'SettlementCurrency'; UsesCurrentNativeBuyerAgreements: true
  UsesCurrentNativeSupplierAgreements?: true
  SourceAttributeWorlds?: ['Fenix']; AdditionalFields?: ['Основний менеджер покупця', 'Код по региону']
  PreservesUnavailableValues: true; RequiresCommonSourceObservation: false; CurrentDaySupported: true
  SourceWorlds: ['Fenix', 'Amg']; RowLayouts: number[][]; Measurements: number[]; Filters: number[]
  FilterExpression: ReportFilterExpressionCapabilities
  BuyerSubtree: { Version: 1; SourceWorld: 'fenix'; BuyerRootId: string; RequiresCompletePeriodLineage: false; UsesCurrentCapturedHierarchy: true }
}

function fields(value: unknown, names: readonly string[]): JsonRecord | null {
  if (!record(value) || Object.keys(value).length !== names.length) return null
  const normalized: JsonRecord = {}
  for (const name of names) {
    const matches = aliases(value, name)
    if (matches.length !== 1) return null
    normalized[name] = value[matches[0]]
  }
  return normalized
}

export function requestGroupedSettlementPeriod(value: object): unknown {
  const key = aliases(value, 'GroupedSettlementPeriod')[0]
  return key === undefined ? undefined : (value as JsonRecord)[key]
}

export function cloneGroupedSettlementAliases(value: object): JsonRecord {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key.toLowerCase() === 'groupedsettlementperiod')
    .map(([key, item]) => [key, structuredClone(item)]))
}

export function groupedSettlementPeriod(value: unknown): GroupedSettlementPeriod | null {
  const normalized = fields(value, ['Version', 'SourceWorld', 'CurrencyBasis'])
  return normalized?.Version === 1 && normalized.CurrencyBasis === 'SettlementCurrency'
    && (normalized.SourceWorld === 'Fenix' || normalized.SourceWorld === 'Amg')
    ? normalized as GroupedSettlementPeriod : null
}

export const defaultGroupedSettlementPeriod = (): GroupedSettlementPeriod => ({
  Version: 1, SourceWorld: 'Fenix', CurrencyBasis: 'SettlementCurrency',
})
export const defaultGroupedSettlementBuyer = (): ReportSourceBuyerSubtree => ({
  Version: 1, SourceWorld: 'fenix', BuyerRootId: EXACT_ONE_C_BUYER_ROOT_ID,
})

export function groupedSettlementCapability(value: unknown): GroupedSettlementCapability | null {
  const supplier = record(value) ? aliases(value, 'UsesCurrentNativeSupplierAgreements') : []
  if (supplier.length > 1) return null
  const attributes = record(value) ? aliases(value, 'SourceAttributeWorlds') : []
  if (attributes.length > 1) return null
  const names: readonly string[] = [...capabilityFields, ...(supplier.length ? ['UsesCurrentNativeSupplierAgreements'] : []),
    ...(attributes.length ? ['SourceAttributeWorlds', 'AdditionalFields'] : [])]
  const normalized = fields(value, names)
  if (attributes.length && (!supplier.length || !normalized || !Array.isArray(normalized.SourceAttributeWorlds)
    || normalized.SourceAttributeWorlds.join(',') !== 'Fenix' || !Array.isArray(normalized.AdditionalFields)
    || normalized.AdditionalFields.join('|') !== 'Основний менеджер покупця|Код по региону')) return null
  if (supplier.length && normalized?.UsesCurrentNativeSupplierAgreements !== true) return null
  const filters = attributes.length ? [...GROUPED_SETTLEMENT_SUPPLIER_FILTERS, 60, 61]
    : supplier.length ? GROUPED_SETTLEMENT_SUPPLIER_FILTERS : GROUPED_SETTLEMENT_FILTERS
  if (!normalized || normalized.Version !== 1 || normalized.MaximumDays !== 31
    || normalized.CurrencyBasis !== 'SettlementCurrency' || normalized.UsesCurrentNativeBuyerAgreements !== true
    || normalized.PreservesUnavailableValues !== true || normalized.RequiresCommonSourceObservation !== false
    || normalized.CurrentDaySupported !== true || !Array.isArray(normalized.SourceWorlds)
    || normalized.SourceWorlds.length !== 2 || normalized.SourceWorlds[0] !== 'Fenix'
    || normalized.SourceWorlds[1] !== 'Amg' || !Array.isArray(normalized.RowLayouts)
    || normalized.RowLayouts.length !== 2 || !normalized.RowLayouts.every((row, index) => exact(row, GROUPED_SETTLEMENT_LAYOUTS[index]))
    || !exact(normalized.Measurements, GROUPED_SETTLEMENT_MEASURES) || !exact(normalized.Filters, filters)) return null
  const expression = fields(normalized.FilterExpression, ['Version', 'MaximumDepth', 'MaximumLeaves', 'MaximumNodes', 'Operators'])
  const filter = expression ? readFilterExpressionCapabilities({ FilterExpression: expression } as ReportDataset) : null
  if (!filter || filter.MaximumDepth !== 8 || filter.MaximumLeaves !== 64 || filter.MaximumNodes !== 128
    || filter.Operators.join(',') !== '1,2') return null
  const buyer = fields(normalized.BuyerSubtree, ['Version', 'SourceWorld', 'BuyerRootId', 'RequiresCompletePeriodLineage', 'UsesCurrentCapturedHierarchy'])
  if (!buyer || buyer.Version !== 1 || buyer.SourceWorld !== 'fenix' || buyer.BuyerRootId !== EXACT_ONE_C_BUYER_ROOT_ID
    || buyer.RequiresCompletePeriodLineage !== false || buyer.UsesCurrentCapturedHierarchy !== true) return null
  return { ...structuredClone(normalized), FilterExpression: structuredClone(filter), BuyerSubtree: structuredClone(buyer) } as GroupedSettlementCapability
}

export function normalizeGroupedSettlementDataset(value: JsonRecord): ReportDataset | null {
  const keys = aliases(value, 'GroupedSettlementPeriod')
  if (keys.length > 1) return null
  const raw = keys.length ? value[keys[0]] : undefined
  const capability = raw == null ? null : groupedSettlementCapability(raw)
  if (raw != null && (value.DataSource !== 41 || !capability)) return null
  const normalized = { ...value }
  for (const key of keys) delete normalized[key]
  if (capability) normalized.groupedSettlementPeriod = capability
  return normalized as ReportDataset
}

export const groupedSettlementSupportsSuppliers = (dataset?: ReportDataset): boolean =>
  groupedSettlementCapability(dataset?.groupedSettlementPeriod)?.UsesCurrentNativeSupplierAgreements === true

export function isGroupedSettlementDataset(dataset?: ReportDataset): boolean {
  const cap = groupedSettlementCapability(dataset?.groupedSettlementPeriod)
  return dataset?.DataSource === 41 && dataset.PeriodRequired === true && dataset.PeriodSupported === true
    && cap !== null
    && Array.isArray(dataset.Groupings) && Array.isArray(dataset.Measurements) && Array.isArray(dataset.Filters)
    && exact(dataset.Groupings.map(item => item.Type), [4, 41, 76, 77])
    && exact(dataset.Measurements.map(item => item.Type), GROUPED_SETTLEMENT_MEASURES)
    && exact(dataset.Filters.map(item => item.Type), cap.Filters)
    && [...dataset.Groupings, ...dataset.Measurements, ...dataset.Filters].every(item => item.Selectable !== false)
}

/** The exact saved route keeps its original no-filter form; grouped capabilities are explicit. */
export function settlementFormDataset(dataset: ReportDataset | undefined, selector: unknown): ReportDataset | undefined {
  if (dataset?.DataSource !== 41) return dataset
  const cap = groupedSettlementCapability(dataset.groupedSettlementPeriod)
  return selector != null && cap ? { ...dataset, FilterExpression: cap.FilterExpression,
    Filters: groupedSettlementPeriod(selector)?.SourceWorld === 'Fenix' ? dataset.Filters
      : dataset.Filters.filter(field => ![60, 61].includes(field.Type)) }
    : { ...dataset, Filters: [], FilterExpression: undefined }
}

export function groupedSettlementRows(available: readonly ReportGroupingItem[], currency: boolean): ReportGroupingItem[] {
  return GROUPED_SETTLEMENT_LAYOUTS[currency ? 0 : 1].map(type => available.find(item => item.type === type)!)
    .filter(Boolean)
}

export function settlementModePatch(mode: 'buyers' | 'agreement', available: readonly ReportGroupingItem[]) {
  return mode === 'buyers'
    ? { grouped: defaultGroupedSettlementPeriod(), buyer: defaultGroupedSettlementBuyer(), rows: groupedSettlementRows(available, true) }
    : { grouped: undefined, buyer: undefined, rows: [4, 41, 76, 77].map(type => available.find(item => item.type === type)!).filter(Boolean) }
}

export function settlementMaximumDate(source: number, selector: unknown, today: string): string | null {
  if (source === 41) return selector != null ? today : previousKyivDay(today)
  return source === 40 ? previousKyivDay(today) : null
}

export function groupedWorkbookRequest(request: ReportRequestBody, currencyAxis?: boolean): ReportRequestBody {
  if (request.dataSource !== 41 || requestGroupedSettlementPeriod(request) == null || currencyAxis !== false) return request
  return { ...request, sorted: { ...request.sorted, Row: request.sorted.Row.filter(row => row.type !== 41) } }
}

function periodError(from: string, to: string, today: string): string | null {
  const valid = (day: string) => /^\d{4}-\d\d-\d\d$/.test(day) && day >= '1900-01-01' && day <= '7998-12-31'
    && Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
  if (!valid(from) || !valid(to) || !valid(today) || from > to || to > today) return 'Оберіть коректний київський період до сьогодні включно.'
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 >= 31
    ? 'Період взаєморозрахунків може охоплювати щонайбільше 31 день.' : null
}

export function groupedSettlementConfigurationError(data: ReportRequestBody, dataset?: ReportDataset,
  today = formatKyivBusinessDate()): string | null {
  if (aliases(data, 'GroupedSettlementPeriod').length > 1) return 'Груповий режим взаєморозрахунків задано двічі.'
  const raw = requestGroupedSettlementPeriod(data)
  if (raw == null) return null
  if (data.dataSource !== 41) return 'Груповий режим взаєморозрахунків належить лише відповідному набору даних.'
  const selector = groupedSettlementPeriod(raw)
  if (!selector) return 'Оберіть базу Fenix або AMG і валюту взаєморозрахунків поточних договорів.'
  if (dataset && !isGroupedSettlementDataset(dataset)) return 'Сервер не підтвердив груповий звіт взаєморозрахунків.'
  const groupsError = sourceCounterpartyGroupsConfigurationError(data, selector.SourceWorld, dataset)
  if (groupsError) return groupsError
  const workbookError = workbookConfigurationError(data, dataset)
  if (workbookError) return workbookError
  const allowed = new Set(['datasource', 'from', 'to', 'sorted', 'selections', 'groupedsettlementperiod', 'filterexpression', 'sourcebuyersubtree', 'sourcecounterpartygroups', 'workbookpresentation'])
  if (Object.entries(data).some(([key, value]) => !allowed.has(key.toLowerCase()) && value != null))
    return 'Групові взаєморозрахунки не поєднуються з точним договором, перерахунком валют або іншими перетвореннями.'
  const dayError = periodError(data.from, data.to, today)
  if (dayError) return dayError
  const rows = Array.isArray(data.sorted?.Row) ? data.sorted.Row.map(item => item?.type) : null
  if (!GROUPED_SETTLEMENT_LAYOUTS.some(layout => exact(rows, layout)) || data.sorted?.Col?.length !== 0
    || !Array.isArray(data.sorted?.Measurements)
    || !exact(data.sorted.Measurements.map(item => item?.Type), GROUPED_SETTLEMENT_MEASURES)
    || data.sorted.Measurements.some(item => item?.IsChecked === false))
    return 'Оберіть організацію → валюту → контрагента або організацію → контрагента та чотири показники залишків і руху.'
  const cap = groupedSettlementCapability(dataset?.groupedSettlementPeriod)
  // Without a catalogue argument, validate the native wire fields; the server remains final authority.
  const filters = cap?.Filters ?? [...GROUPED_SETTLEMENT_SUPPLIER_FILTERS, 60, 61]
  const allowedFilters = new Set<number>(filters)
  if (!Array.isArray(data.selections) || data.selections.some(selection => selection?.IsChecked !== false
    && (!allowedFilters.has(selection?.SelectedField?.Type)
      || ![0, 1, 2, 4].includes(selection?.FilterCondition?.Type) || !Array.isArray(selection?.Values)
      || !selection.Values.length || selection.Values.some(value => [60, 61].includes(selection.SelectedField.Type)
        ? selector.SourceWorld !== 'Fenix' || settlementAttributeKey(selection.SelectedField.Type, value?.Data) === null
        : revenueExactId(value?.Data) === null))))
    return 'Оберіть точні організації, покупців, постачальників, їхні договори або валюти з поточних списків.'
  const buyerKeys = aliases(data, 'SourceBuyerSubtree')
  if (buyerKeys.length > 1) return 'Відбір групи покупців задано двічі.'
  const buyer = buyerKeys.length ? (data as unknown as JsonRecord)[buyerKeys[0]] : undefined
  const selected = fields(buyer, ['Version', 'SourceWorld', 'BuyerRootId'])
  if (buyer != null && (selector.SourceWorld !== 'Fenix' || !selected || selected.Version !== 1
    || selected.SourceWorld !== 'fenix' || typeof selected.BuyerRootId !== 'string'
    || selected.BuyerRootId.toUpperCase() !== EXACT_ONE_C_BUYER_ROOT_ID))
    return 'Група «Покупці» доступна для відповідного поточного довідника Fenix.'
  const treeDataset = cap ? { ...dataset!, FilterExpression: cap.FilterExpression }
    : { FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] } } as ReportDataset
  return reportFilterExpressionError(data, treeDataset)
}
