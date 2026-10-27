import { isProfitReadModeCapability, profitReadModeConfigurationError } from './profitReadMode'
import { isDayOrganizationBasisCapability } from './dayOrganizationBasis'
import { isSupplierBasisCapability, requestSupplierBasis, supplierBasisConfigurationError } from './supplierBasis'
import { groupedSettlementConfigurationError, requestGroupedSettlementPeriod } from './groupedSettlementPeriod'
import type {
  ReportDataset,
  ReportProductClassification,
  ReportProductClassificationCapabilities,
  ReportRequestBody,
  ReportSourceOrganizations,
  ReportSourceOrganizationsCapabilities,
  ReportSourceBuyerSubtree,
  ReportSourceBuyerSubtreeCapabilities,
} from '../types'

export const NATIVE_EXACT_FILTER_SOURCE = 2
export const DAY_ORGANIZATION_EXACT_FILTER_SOURCE = 35
export const SUPPLIER_GROSS_PROFIT_EXACT_FILTER_SOURCE = 38
export const FENIX_BUYERS_ROOT_ID = '8AB2005056C0000811DEFC4535BB4D40'
const SOURCE_REFERENCE = /^[0-9a-f]{32}$/i
const ZERO_REFERENCE = /^0{32}$/
const PRODUCT_FIELDS = ['Version', 'SourceWorld', 'ProductKindId', 'IsService'] as const
const ORGANIZATION_FIELDS = ['Version', 'SourceWorld', 'OrganizationIds'] as const
const BUYER_FIELDS = ['Version', 'SourceWorld', 'BuyerRootId'] as const
const PRODUCT_CAPABILITY_FIELDS = ['Version', 'SourceWorld', 'RequiresIsService', 'RequiresProductKindId', 'ProductKindIdFormat'] as const
const ORGANIZATION_CAPABILITY_FIELDS = ['Version', 'SourceWorlds', 'MaximumOrganizationIds', 'OrganizationIdFormat', 'RequiresDurableNativeBinding', 'RequiresCompleteFactLineage'] as const
const BUYER_CAPABILITY_FIELDS = ['Version', 'SourceWorld', 'BuyerRootId', 'RequiresCompletePeriodLineage', 'UsesCurrentCapturedHierarchy'] as const
const SERVICE_FIELDS = ['Version', 'IsService'] as const
const SERVICE_CAPABILITY_FIELDS = ['Version', 'IsServiceValues', 'GoodsKind', 'Basis'] as const
export const GOODS_KIND_ID = '8AB2005056C0000811DEF956DA4CFDA0'
export const SERVICE_KIND_ID = '8FC4005056C0000811DF10AE5525F8C8'
export const PRODUCT_CLASSIFICATION_RESAVE_ERROR = 'Шаблон містить відбір виду товару 1С. Відкрийте його у формі: відбір буде замінено на рівнозначний відбір GBA («Товар без послуг» або «Послуги»). Перегляньте налаштування й збережіть шаблон повторно.'
export type ReportProductServiceFilter = { Version: 1; IsService: boolean }
export const goodsWithoutServices = (): ReportProductServiceFilter => ({ Version: 1, IsService: false })

type JsonRecord = Record<string, unknown>

function record(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function aliases(value: object, name: string): string[] {
  return Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
}

function exactFields<const T extends readonly string[]>(value: unknown, fields: T): Record<T[number], unknown> | null {
  if (!record(value) || Object.keys(value).length !== fields.length) return null
  const normalized: Partial<Record<T[number], unknown>> = {}
  for (const field of fields) {
    const matches = aliases(value, field)
    if (matches.length !== 1) return null
    normalized[field as T[number]] = value[matches[0]]
  }
  return normalized as Record<T[number], unknown>
}

function sourceReference(value: unknown): value is string {
  return typeof value === 'string' && SOURCE_REFERENCE.test(value) && !ZERO_REFERENCE.test(value)
}

/** Source filters and their calculation basis round-trip together, including null and raw aliases. */
export function cloneNativeExactFilterAliases(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const name = key.toLowerCase()
    return name === 'productclassification' || name === 'productservicefilter' || name === 'sourceorganizations' || name === 'sourcebuyersubtree'
      || name === 'dayorganizationbasis' || name === 'supplierbasis' || name === 'profitreadmode'
      ? [[key, structuredClone(item)]]
      : []
  }))
}

export function requestProductClassification(value: object): unknown {
  const key = aliases(value, 'ProductClassification')[0]
  return key === undefined ? undefined : (value as JsonRecord)[key]
}

export function requestProductServiceFilter(value: object): unknown {
  const key = aliases(value, 'ProductServiceFilter')[0]
  return key === undefined ? undefined : (value as JsonRecord)[key]
}

export function productServiceFilter(value: unknown): ReportProductServiceFilter | null {
  const fields = exactFields(value, SERVICE_FIELDS)
  return fields && fields.Version === 1 && typeof fields.IsService === 'boolean' ? fields as ReportProductServiceFilter : null
}

export function isProductServiceFilterCapability(value: unknown): boolean {
  const fields = exactFields(value, SERVICE_CAPABILITY_FIELDS)
  return fields?.Version === 1 && Array.isArray(fields.IsServiceValues) && fields.IsServiceValues.includes(false)
    && fields.Basis === 'GbaProductClassification'
}

export function productServiceFromClassification(value: unknown): ReportProductServiceFilter | null {
  const classification = productClassification(value)
  if (!classification) return null
  const kind = classification.ProductKindId.toUpperCase()
  if (classification.IsService) return kind === SERVICE_KIND_ID ? { Version: 1, IsService: true } : null
  return kind === GOODS_KIND_ID ? goodsWithoutServices() : null
}

export function unmappedProductClassificationError(value: unknown): string {
  const classification = productClassification(value)
  const dropped = classification
    ? `вид ${classification.ProductKindId.toUpperCase()}, ${classification.IsService ? 'лише послуги' : 'без послуг'}`
    : 'некоректний відбір'
  return `Шаблон містить відбір виду товару 1С (${dropped}), для якого в GBA немає рівнозначного відбору. Без нього звіт охопив би більше товарів, тому його не сформовано. Вилучіть цей відбір у розділі «Відбори», перегляньте налаштування й збережіть шаблон повторно.`
}

export function productClassificationReviewError(data: object, dataset?: ReportDataset): string | null {
  const product = requestProductClassification(data)
  if (product == null || (data as { dataSource?: unknown }).dataSource !== DAY_ORGANIZATION_EXACT_FILTER_SOURCE
    || !dataset || !isProductServiceFilterCapability(dataset.productServiceFilter)) return null
  return productServiceFromClassification(product) ? PRODUCT_CLASSIFICATION_RESAVE_ERROR : unmappedProductClassificationError(product)
}

export function requestSourceOrganizations(value: object): unknown {
  const key = aliases(value, 'SourceOrganizations')[0]
  return key === undefined ? undefined : (value as JsonRecord)[key]
}

export function requestSourceBuyerSubtree(value: object): unknown {
  const key = aliases(value, 'SourceBuyerSubtree')[0]
  return key === undefined ? undefined : (value as JsonRecord)[key]
}

export function productClassification(value: unknown): ReportProductClassification | null {
  const fields = exactFields(value, PRODUCT_FIELDS)
  if (!fields || fields.Version !== 1 || fields.SourceWorld !== 0 || !sourceReference(fields.ProductKindId)
    || typeof fields.IsService !== 'boolean') return null
  return fields as ReportProductClassification
}

export function sourceOrganizations(value: unknown): ReportSourceOrganizations | null {
  const fields = exactFields(value, ORGANIZATION_FIELDS)
  if (!fields || fields.Version !== 1 || fields.SourceWorld !== 'fenix' || !Array.isArray(fields.OrganizationIds)
    || fields.OrganizationIds.length < 1 || fields.OrganizationIds.length > 64
    || !fields.OrganizationIds.every(sourceReference)
    || new Set(fields.OrganizationIds.map(id => id.toLowerCase())).size !== fields.OrganizationIds.length) return null
  return fields as ReportSourceOrganizations
}

export function sourceBuyerSubtree(value: unknown): ReportSourceBuyerSubtree | null {
  const fields = exactFields(value, BUYER_FIELDS)
  if (!fields || fields.Version !== 1 || fields.SourceWorld !== 'fenix'
    || typeof fields.BuyerRootId !== 'string'
    || fields.BuyerRootId.toUpperCase() !== FENIX_BUYERS_ROOT_ID) return null
  return fields as ReportSourceBuyerSubtree
}

export function isProductClassificationCapability(value: unknown): value is ReportProductClassificationCapabilities {
  const fields = exactFields(value, PRODUCT_CAPABILITY_FIELDS)
  return fields?.Version === 1 && fields.SourceWorld === 0 && fields.RequiresIsService === true
    && fields.RequiresProductKindId === true
    && fields.ProductKindIdFormat === '32 hexadecimal characters (16 bytes)'
}

export function isSourceOrganizationsCapability(value: unknown): value is ReportSourceOrganizationsCapabilities {
  const fields = exactFields(value, ORGANIZATION_CAPABILITY_FIELDS)
  return fields?.Version === 1 && Array.isArray(fields.SourceWorlds) && fields.SourceWorlds.length === 1
    && fields.SourceWorlds[0] === 'fenix' && fields.MaximumOrganizationIds === 64
    && fields.OrganizationIdFormat === '32 hexadecimal characters (16 bytes)'
    && fields.RequiresDurableNativeBinding === true && fields.RequiresCompleteFactLineage === true
}

export function isSourceBuyerSubtreeCapability(value: unknown): value is ReportSourceBuyerSubtreeCapabilities {
  const fields = exactFields(value, BUYER_CAPABILITY_FIELDS)
  return fields?.Version === 1 && fields.SourceWorld === 'fenix'
    && fields.BuyerRootId === FENIX_BUYERS_ROOT_ID
    && fields.RequiresCompletePeriodLineage === true
    && fields.UsesCurrentCapturedHierarchy === true
}

export function normalizeNativeExactFilterDataset(value: JsonRecord): ReportDataset | null {
  const source = value.DataSource
  const productKeys = aliases(value, 'ProductClassification')
  const organizationKeys = aliases(value, 'SourceOrganizations')
  const buyerKeys = aliases(value, 'SourceBuyerSubtree')
  const modeKeys = aliases(value, 'ProfitReadMode')
  if (modeKeys.length > 1) return null
  const mode = modeKeys.length ? value[modeKeys[0]] : undefined
  if (modeKeys.length && (![35, 38].includes(Number(source)) || !isProfitReadModeCapability(mode))) return null
  const basisKeys = aliases(value, 'DayOrganizationBasis')
  const supplierBasisKeys = aliases(value, 'SupplierBasis')
  if (productKeys.length > 1 || organizationKeys.length > 1 || buyerKeys.length > 1
    || basisKeys.length > 1 || supplierBasisKeys.length > 1) return null
  const basis = basisKeys.length ? value[basisKeys[0]] : undefined
  if (basis !== undefined && (source !== DAY_ORGANIZATION_EXACT_FILTER_SOURCE
    || !isDayOrganizationBasisCapability(basis))) return null
  const supplierBasis = supplierBasisKeys.length ? value[supplierBasisKeys[0]] : undefined
  if (supplierBasis !== undefined && (source !== SUPPLIER_GROSS_PROFIT_EXACT_FILTER_SOURCE
    || !isSupplierBasisCapability(supplierBasis) || !Array.isArray(value.Groupings)
    || !value.Groupings.some(field => record(field) && field.Type === 78 && field.Selectable !== false))) return null
  const product = productKeys.length ? value[productKeys[0]] : undefined
  const organizations = organizationKeys.length ? value[organizationKeys[0]] : undefined
  const buyers = buyerKeys.length ? value[buyerKeys[0]] : undefined
  if (source === NATIVE_EXACT_FILTER_SOURCE) {
    if (!isProductClassificationCapability(product) || !isSourceOrganizationsCapability(organizations) || buyers != null) return null
  } else if (source === DAY_ORGANIZATION_EXACT_FILTER_SOURCE) {
    if (!isProductClassificationCapability(product) || !isSourceOrganizationsCapability(organizations)
      || !isSourceBuyerSubtreeCapability(buyers)) return null
  } else if (source === SUPPLIER_GROSS_PROFIT_EXACT_FILTER_SOURCE) {
    if (product != null || organizations != null
      || buyers != null && !isSourceBuyerSubtreeCapability(buyers)) return null
  } else if (product != null || organizations != null || buyers != null) {
    return null
  }
  const normalized = { ...value } as JsonRecord
  for (const key of productKeys) delete normalized[key]
  for (const key of organizationKeys) delete normalized[key]
  for (const key of buyerKeys) delete normalized[key]
  for (const key of modeKeys) delete normalized[key]
  if (modeKeys.length) normalized.profitReadMode = structuredClone(mode)
  for (const key of basisKeys) delete normalized[key]
  for (const key of supplierBasisKeys) delete normalized[key]
  if (product != null) normalized.productClassification = structuredClone(product)
  if (organizations != null) normalized.sourceOrganizations = structuredClone(organizations)
  if (buyers != null) normalized.sourceBuyerSubtree = structuredClone(buyers)
  if (basis !== undefined) normalized.dayOrganizationBasis = structuredClone(basis)
  if (supplierBasis !== undefined) normalized.supplierBasis = structuredClone(supplierBasis)
  return normalized as ReportDataset
}

export function nativeExactFiltersConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const modeError = profitReadModeConfigurationError(data, dataset)
  if (modeError) return modeError
  const supplierBasisError = supplierBasisConfigurationError(data, dataset)
  if (supplierBasisError) return supplierBasisError
  const productKeys = aliases(data, 'ProductClassification')
  const organizationKeys = aliases(data, 'SourceOrganizations')
  const buyerKeys = aliases(data, 'SourceBuyerSubtree')
  if (productKeys.length > 1 || organizationKeys.length > 1 || buyerKeys.length > 1) {
    return 'Точні відбори Fenix задані двічі. Налаштування не застосовано.'
  }
  const serviceKeys = aliases(data, 'ProductServiceFilter')
  if (serviceKeys.length > 1) return 'Відбір «Товар без послуг» задано двічі. Налаштування не застосовано.'
  const service = requestProductServiceFilter(data)
  if (service != null) {
    if (data.dataSource !== DAY_ORGANIZATION_EXACT_FILTER_SOURCE || !productServiceFilter(service))
      return 'Відбір «Товар без послуг» доступний лише для валового прибутку за днем.'
    if (dataset && !isProductServiceFilterCapability(dataset.productServiceFilter))
      return 'Сервер не підтвердив відбір «Товар без послуг».'
    if (requestProductClassification(data) != null)
      return 'Не поєднуйте відбір «Товар без послуг» з відбором виду товару 1С.'
  }
  const classificationReview = productClassificationReviewError(data, dataset)
  if (classificationReview) return classificationReview
  const product = requestProductClassification(data)
  const organizations = requestSourceOrganizations(data)
  const buyers = requestSourceBuyerSubtree(data)
  if (data.dataSource === 41 && requestGroupedSettlementPeriod(data) != null) {
    if (product != null || organizations != null) return 'Групові взаєморозрахунки підтримують поточні локальні відбори та групу покупців.'
    return groupedSettlementConfigurationError(data, dataset)
  }
  if (data.dataSource !== NATIVE_EXACT_FILTER_SOURCE
    && data.dataSource !== DAY_ORGANIZATION_EXACT_FILTER_SOURCE
    && data.dataSource !== SUPPLIER_GROSS_PROFIT_EXACT_FILTER_SOURCE) {
    return product != null || organizations != null || buyers != null
      ? 'Цей набір не підтримує точні відбори Fenix. Налаштування не застосовано.'
      : null
  }
  if (product != null && !productClassification(product)) {
    return 'Некоректний точний відбір виду товару Fenix. Налаштування не застосовано.'
  }
  if (organizations != null && !sourceOrganizations(organizations)) {
    return 'Некоректний точний відбір організацій Fenix. Налаштування не застосовано.'
  }
  if (data.dataSource === SUPPLIER_GROSS_PROFIT_EXACT_FILTER_SOURCE
    && (product != null || organizations != null)) {
    return 'Партійний прибуток підтримує лише точне піддерево покупців Fenix.'
  }
  if (buyers != null && (![DAY_ORGANIZATION_EXACT_FILTER_SOURCE, SUPPLIER_GROSS_PROFIT_EXACT_FILTER_SOURCE]
    .includes(data.dataSource) || !sourceBuyerSubtree(buyers))) {
    return 'Некоректний точний відбір піддерева «Покупці» Fenix. Налаштування не застосовано.'
  }
  const supplierWorld = Object.prototype.hasOwnProperty.call(data, 'supplierSourceWorld')
    ? data.supplierSourceWorld : data.SupplierSourceWorld
  if (buyers != null && data.dataSource === SUPPLIER_GROSS_PROFIT_EXACT_FILTER_SOURCE
    && supplierWorld !== 0 && !(requestSupplierBasis(data) === 0 && supplierWorld == null)) {
    return 'Для піддерева «Покупці» оберіть базу продажів Fenix.'
  }
  if (organizations != null && Array.isArray(data.selections) && data.selections.some(selection =>
    selection?.IsChecked !== false && selection?.SelectedField?.Type === 0)) {
    return 'Не поєднуйте точні організації Fenix з нативним відбором за організацією. Налаштування не застосовано.'
  }
  if (dataset && (data.dataSource === NATIVE_EXACT_FILTER_SOURCE
    || data.dataSource === DAY_ORGANIZATION_EXACT_FILTER_SOURCE)
    && !isProductClassificationCapability(dataset.productClassification)) {
    return 'Сервер не підтвердив точний відбір виду товару Fenix.'
  }
  if (dataset && (data.dataSource === NATIVE_EXACT_FILTER_SOURCE
    || data.dataSource === DAY_ORGANIZATION_EXACT_FILTER_SOURCE)
    && !isSourceOrganizationsCapability(dataset.sourceOrganizations)) {
    return 'Сервер не підтвердив точний відбір організацій Fenix.'
  }
  if (dataset && (data.dataSource === DAY_ORGANIZATION_EXACT_FILTER_SOURCE
    || data.dataSource === SUPPLIER_GROSS_PROFIT_EXACT_FILTER_SOURCE && buyers != null)
    && !isSourceBuyerSubtreeCapability(dataset.sourceBuyerSubtree)) {
    return 'Сервер не підтвердив точний відбір піддерева «Покупці» Fenix.'
  }
  return null
}
