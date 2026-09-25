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

export function cloneNativeExactFilterAliases(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const name = key.toLowerCase()
    return name === 'productclassification' || name === 'sourceorganizations' || name === 'sourcebuyersubtree'
      ? [[key, structuredClone(item)]]
      : []
  }))
}

export function requestProductClassification(value: object): unknown {
  const key = aliases(value, 'ProductClassification')[0]
  return key === undefined ? undefined : (value as JsonRecord)[key]
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
  if (productKeys.length > 1 || organizationKeys.length > 1 || buyerKeys.length > 1) return null
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
  if (product != null) normalized.productClassification = structuredClone(product)
  if (organizations != null) normalized.sourceOrganizations = structuredClone(organizations)
  if (buyers != null) normalized.sourceBuyerSubtree = structuredClone(buyers)
  return normalized as ReportDataset
}

export function nativeExactFiltersConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const productKeys = aliases(data, 'ProductClassification')
  const organizationKeys = aliases(data, 'SourceOrganizations')
  const buyerKeys = aliases(data, 'SourceBuyerSubtree')
  if (productKeys.length > 1 || organizationKeys.length > 1 || buyerKeys.length > 1) {
    return 'Точні відбори Fenix задані двічі. Налаштування не застосовано.'
  }
  const product = requestProductClassification(data)
  const organizations = requestSourceOrganizations(data)
  const buyers = requestSourceBuyerSubtree(data)
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
  if (buyers != null && data.dataSource === SUPPLIER_GROSS_PROFIT_EXACT_FILTER_SOURCE
    && data.supplierSourceWorld !== 0 && data.SupplierSourceWorld !== 0) {
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
