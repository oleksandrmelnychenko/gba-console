import type {
  ProductCapitalizationCreatePayload,
  ProductCapitalizationCreateReference,
  ProductCapitalizationCreateWireItem,
  ProductCapitalizationCreateWirePayload,
  ProductCapitalizationItem,
} from './types'

const MAXIMUM_COMMENT_LENGTH = 500
const MAXIMUM_ITEM_COUNT = 500
const SQL_DATETIME_MINIMUM = Date.UTC(1753, 0, 1)
const SQL_DATETIME_MAXIMUM = Date.UTC(9999, 11, 31, 23, 59, 59, 997)
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function toProductCapitalizationCreateWirePayload(
  payload: ProductCapitalizationCreatePayload,
): ProductCapitalizationCreateWirePayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Product capitalization payload is required')
  }

  const comment = payload.Comment ?? ''
  if (typeof comment !== 'string' || comment.length > MAXIMUM_COMMENT_LENGTH) {
    throw new Error(
      `Product capitalization comment cannot exceed ${MAXIMUM_COMMENT_LENGTH} characters`,
    )
  }

  const fromDate = normalizeSqlDateTime(payload.FromDate)
  const organization = normalizeReference(
    payload.Organization,
    undefined,
    'organization',
  )
  const storage = normalizeReference(
    payload.Storage,
    undefined,
    'storage',
  )
  if (
    !Array.isArray(payload.ProductCapitalizationItems)
    || payload.ProductCapitalizationItems.length === 0
    || payload.ProductCapitalizationItems.length > MAXIMUM_ITEM_COUNT
  ) {
    throw new Error(
      `Product capitalization requires between 1 and ${MAXIMUM_ITEM_COUNT} items`,
    )
  }

  const items = payload.ProductCapitalizationItems
    .map(normalizeItem)
    .sort((left, right) =>
      left.Product.NetUid.localeCompare(right.Product.NetUid))
  const productNetUids = new Set<string>()
  items.forEach((item) => {
    if (productNetUids.has(item.Product.NetUid)) {
      throw new Error(
        'Duplicate product rows are not allowed in a capitalization',
      )
    }
    productNetUids.add(item.Product.NetUid)
  })

  return deepFreeze({
    Comment: comment,
    FromDate: fromDate,
    Organization: organization,
    ...(organization.Id ? { OrganizationId: organization.Id } : {}),
    ProductCapitalizationItems: items,
    Storage: storage,
    ...(storage.Id ? { StorageId: storage.Id } : {}),
  })
}

function normalizeItem(
  item: ProductCapitalizationItem,
): ProductCapitalizationCreateWireItem {
  if (!item || typeof item !== 'object') {
    throw new Error('Every product capitalization item is required')
  }

  const product = normalizeReference(
    item.Product,
    item.ProductId,
    'product',
  )
  const quantity = normalizeFiniteNumber(item.Qty, 'quantity')
  const unitPrice = normalizeFiniteNumber(item.UnitPrice, 'unit price')
  const weight = normalizeFiniteNumber(item.Weight ?? 0, 'weight')

  if (quantity <= 0) {
    throw new Error('Product capitalization quantity must be positive')
  }
  if (unitPrice < 0 || weight < 0) {
    throw new Error(
      'Product capitalization price and weight cannot be negative',
    )
  }

  return {
    Product: product,
    ...(product.Id ? { ProductId: product.Id } : {}),
    Qty: quantity,
    UnitPrice: unitPrice,
    Weight: weight,
  }
}

function normalizeReference(
  entity: { Id?: number; NetUid?: string } | undefined,
  topLevelId: number | undefined,
  name: string,
): ProductCapitalizationCreateReference {
  const nestedId = normalizeOptionalId(entity?.Id, name)
  const explicitId = normalizeOptionalId(topLevelId, name)
  if (nestedId && explicitId && nestedId !== explicitId) {
    throw new Error(
      `Product capitalization ${name} Id values must match`,
    )
  }

  const netUid = normalizeUuid(entity?.NetUid, name)
  const id = explicitId ?? nestedId

  return {
    ...(id ? { Id: id } : {}),
    NetUid: netUid,
  }
}

function normalizeOptionalId(
  value: number | undefined,
  name: string,
): number | undefined {
  if (value === undefined || value === 0) {
    return undefined
  }
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(
      `Product capitalization ${name} Id must be a positive safe integer`,
    )
  }

  return value
}

function normalizeUuid(
  value: string | undefined,
  name: string,
): string {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (
    !UUID_PATTERN.test(normalized)
    || normalized === '00000000-0000-0000-0000-000000000000'
  ) {
    throw new Error(
      `Product capitalization ${name} NetUid must be a non-empty UUID`,
    )
  }

  return normalized
}

function normalizeFiniteNumber(
  value: number | undefined,
  name: string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Product capitalization ${name} must be finite`,
    )
  }

  return Object.is(value, -0) ? 0 : value
}

function normalizeSqlDateTime(value: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Product capitalization date is required')
  }

  const date = new Date(value)
  const timestamp = date.getTime()
  if (
    !Number.isFinite(timestamp)
    || timestamp < SQL_DATETIME_MINIMUM
    || timestamp > SQL_DATETIME_MAXIMUM
  ) {
    throw new Error(
      'Product capitalization date is outside the SQL datetime range',
    )
  }

  return date.toISOString()
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)
  Object.values(value).forEach(deepFreeze)

  return value
}
