import type { SalesUkraineOrderItem } from './types'
import { SalesMutationPreflightValidationError } from './salesMutationOperation'

export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
export const SALES_TTN_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
export const SALES_TTN_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_TTN_MIME_TYPES: Record<string, ReadonlySet<string>> = {
  jpeg: new Set(['image/jpeg']),
  jpg: new Set(['image/jpeg']),
  pdf: new Set(['application/pdf']),
  png: new Set(['image/png']),
}

export function normalizePersistedGuid(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? ''

  return normalized && normalized !== EMPTY_GUID && GUID_PATTERN.test(normalized)
    ? normalized
    : null
}

export function requirePersistedGuid(value: string | null | undefined, message: string): string {
  const normalized = normalizePersistedGuid(value)

  if (!normalized) {
    throw new SalesMutationPreflightValidationError(message)
  }

  return normalized
}

export function requirePositiveFiniteQuantity(value: unknown, message: string): number {
  const quantity = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.replace(',', '.'))
      : Number.NaN

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new SalesMutationPreflightValidationError(message)
  }

  return quantity
}

export function getOrderItemQuantityLimit(
  item: SalesUkraineOrderItem,
  isVatSale: boolean,
): number | null {
  const product = item.Product

  if (!product) {
    return null
  }

  const availabilityValues = isVatSale
    ? [product.AvailableQtyUkVAT]
    : [product.AvailableQtyUk, product.AvailableQtyUkReSale]
  const parsedAvailability = availabilityValues.map(readFiniteNumber)

  if (parsedAvailability.every((value) => value === null)) {
    return null
  }

  const currentQuantity = Math.max(0, readFiniteNumber(item.Qty) ?? 0)
  const availableQuantity = parsedAvailability.reduce<number>(
    (total, value) => total + Math.max(0, value ?? 0),
    0,
  )

  return currentQuantity + availableQuantity
}

export function getSalesTtnFileValidationError(file: File | null | undefined): string | null {
  if (!file) {
    return null
  }

  if (file.size <= 0) {
    return 'Файл ТТН порожній'
  }

  if (file.size > SALES_TTN_MAX_FILE_SIZE_BYTES) {
    return 'Файл ТТН має бути не більше 50 МБ'
  }

  const extension = file.name.split('.').pop()?.trim().toLowerCase() ?? ''
  const allowedMimeTypes = ALLOWED_TTN_MIME_TYPES[extension]

  if (!allowedMimeTypes) {
    return 'Файл ТТН має бути у форматі PDF, JPEG або PNG'
  }

  const mimeType = file.type.trim().toLowerCase()

  if (mimeType && mimeType !== 'application/octet-stream' && !allowedMimeTypes.has(mimeType)) {
    return 'Тип файлу ТТН не відповідає його розширенню'
  }

  return null
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'))

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
