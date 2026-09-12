import type {
  ReportDataset,
  ReportProductClassification,
  ReportProductClassificationCapabilities,
  ReportRequestBody,
  ReportSourceOrganizations,
  ReportSourceOrganizationsCapabilities,
} from '../types'

export const NATIVE_EXACT_FILTER_SOURCE = 2
const SOURCE_REFERENCE = /^[0-9a-f]{32}$/i
const ZERO_REFERENCE = /^0{32}$/
const PRODUCT_FIELDS = ['Version', 'SourceWorld', 'ProductKindId', 'IsService'] as const
const ORGANIZATION_FIELDS = ['Version', 'SourceWorld', 'OrganizationIds'] as const
const PRODUCT_CAPABILITY_FIELDS = ['Version', 'SourceWorld', 'RequiresIsService', 'RequiresProductKindId', 'ProductKindIdFormat'] as const
const ORGANIZATION_CAPABILITY_FIELDS = ['Version', 'SourceWorlds', 'MaximumOrganizationIds', 'OrganizationIdFormat', 'RequiresDurableNativeBinding', 'RequiresCompleteFactLineage'] as const

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
    return name === 'productclassification' || name === 'sourceorganizations'
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

export function normalizeNativeExactFilterDataset(value: JsonRecord): ReportDataset | null {
  const source = value.DataSource
  const productKeys = aliases(value, 'ProductClassification')
  const organizationKeys = aliases(value, 'SourceOrganizations')
  if (productKeys.length > 1 || organizationKeys.length > 1) return null
  const product = productKeys.length ? value[productKeys[0]] : undefined
  const organizations = organizationKeys.length ? value[organizationKeys[0]] : undefined
  if (source === NATIVE_EXACT_FILTER_SOURCE) {
    if (!isProductClassificationCapability(product) || !isSourceOrganizationsCapability(organizations)) return null
  } else if (product != null || organizations != null) {
    return null
  }
  const normalized = { ...value } as JsonRecord
  for (const key of productKeys) delete normalized[key]
  for (const key of organizationKeys) delete normalized[key]
  if (product != null) normalized.productClassification = structuredClone(product)
  if (organizations != null) normalized.sourceOrganizations = structuredClone(organizations)
  return normalized as ReportDataset
}

export function nativeExactFiltersConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const productKeys = aliases(data, 'ProductClassification')
  const organizationKeys = aliases(data, 'SourceOrganizations')
  if (productKeys.length > 1 || organizationKeys.length > 1) {
    return 'Точні відбори Fenix задані двічі. Налаштування не застосовано.'
  }
  const product = requestProductClassification(data)
  const organizations = requestSourceOrganizations(data)
  if (data.dataSource !== NATIVE_EXACT_FILTER_SOURCE) {
    return product != null || organizations != null
      ? 'Точні відбори Fenix підтримує лише набір «Продажі мінус повернення». Налаштування не застосовано.'
      : null
  }
  if (product != null && !productClassification(product)) {
    return 'Некоректний точний відбір виду товару Fenix. Налаштування не застосовано.'
  }
  if (organizations != null && !sourceOrganizations(organizations)) {
    return 'Некоректний точний відбір організацій Fenix. Налаштування не застосовано.'
  }
  if (organizations != null && Array.isArray(data.selections) && data.selections.some(selection =>
    selection?.IsChecked !== false && selection?.SelectedField?.Type === 0)) {
    return 'Не поєднуйте точні організації Fenix з нативним відбором за організацією. Налаштування не застосовано.'
  }
  if (dataset && (!isProductClassificationCapability(dataset.productClassification)
    || !isSourceOrganizationsCapability(dataset.sourceOrganizations))) {
    return 'Сервер не підтвердив точні відбори виду товару та організацій Fenix.'
  }
  return null
}
