import { readSession } from '../../../shared/auth/session'

const STORAGE_KEY_PREFIX = 'gba:ukraine-cart-reservation:v1'
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PendingCartReservationOperation = {
  fingerprint: string
  operationNetUid: string
  storageKey: string
}

export class CartReservationPendingOperationError extends Error {
  constructor() {
    super(
      'Попередня зміна резерву має невідомий результат. Повторіть той самий запит або оновіть дані кошика.',
    )
    this.name = 'CartReservationPendingOperationError'
  }
}

export class CartReservationOperationStorageError extends Error {
  constructor() {
    super('Не вдалося безпечно зберегти ідентифікатор операції резервування.')
    this.name = 'CartReservationOperationStorageError'
  }
}

export function acquireCartReservationUpdateOperation(target: {
  Id: number
  NetUid: string
  ProductId: number
  ReservedQty: number
}): PendingCartReservationOperation {
  return acquireOperation(
    `update:${target.NetUid.toLowerCase()}`,
    stableSerialize(target),
  )
}

export function acquireCartReservationUploadOperation(
  file: File,
  parseConfiguration: unknown,
): PendingCartReservationOperation {
  return acquireOperation(
    'upload',
    stableSerialize({
      file: {
        lastModified: file.lastModified,
        name: file.name,
        size: file.size,
        type: file.type,
      },
      parseConfiguration,
    }),
  )
}

export function clearCartReservationOperation(
  operation: PendingCartReservationOperation,
) {
  try {
    const storage = getStorage()
    const persisted = readPendingOperation(storage, operation.storageKey)

    if (persisted?.operationNetUid === operation.operationNetUid) {
      storage.removeItem(operation.storageKey)
    }
  } catch {
    // A confirmed server response remains authoritative if local cleanup fails.
  }
}

export function isDefinitiveCartReservationFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return false
  }

  const status = Number(error.status)
  return Number.isInteger(status)
    && status >= 400
    && status < 500
    && status !== 408
}

function acquireOperation(
  scope: string,
  fingerprint: string,
): PendingCartReservationOperation {
  const storage = getStorage()
  const storageKey = getStorageKey(scope)
  const persisted = readPendingOperation(storage, storageKey)

  if (persisted) {
    if (persisted.fingerprint !== fingerprint) {
      throw new CartReservationPendingOperationError()
    }

    return persisted
  }

  const pending: PendingCartReservationOperation = {
    fingerprint,
    operationNetUid: createOperationNetUid(),
    storageKey,
  }

  try {
    storage.setItem(storageKey, JSON.stringify(pending))
    const confirmed = readPendingOperation(storage, storageKey)

    if (
      !confirmed
      || confirmed.operationNetUid !== pending.operationNetUid
      || confirmed.fingerprint !== pending.fingerprint
    ) {
      throw new CartReservationOperationStorageError()
    }
  } catch (error) {
    if (error instanceof CartReservationOperationStorageError) {
      throw error
    }

    throw new CartReservationOperationStorageError()
  }

  return pending
}

function getStorage(): Storage {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      throw new CartReservationOperationStorageError()
    }

    return globalThis.localStorage
  } catch {
    throw new CartReservationOperationStorageError()
  }
}

function getStorageKey(scope: string): string {
  const userNetUid = readSession()?.userNetUid?.trim().toLowerCase()

  if (!userNetUid || !GUID_PATTERN.test(userNetUid)) {
    throw new CartReservationOperationStorageError()
  }

  return `${STORAGE_KEY_PREFIX}:${userNetUid}:${scope}`
}

function readPendingOperation(
  storage: Storage,
  storageKey: string,
): PendingCartReservationOperation | null {
  let raw: string | null

  try {
    raw = storage.getItem(storageKey)
  } catch {
    throw new CartReservationOperationStorageError()
  }

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingCartReservationOperation>

    if (
      typeof parsed.fingerprint !== 'string'
      || typeof parsed.operationNetUid !== 'string'
      || !GUID_PATTERN.test(parsed.operationNetUid)
    ) {
      throw new CartReservationOperationStorageError()
    }

    return {
      fingerprint: parsed.fingerprint,
      operationNetUid: parsed.operationNetUid.toLowerCase(),
      storageKey,
    }
  } catch (error) {
    if (error instanceof CartReservationOperationStorageError) {
      throw error
    }

    throw new CartReservationOperationStorageError()
  }
}

function stableSerialize(value: unknown): string {
  if (typeof value === 'undefined') {
    return '"<undefined>"'
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`
  }

  const record = value as Record<string, unknown>
  const properties = Object.keys(record)
    .filter((key) => typeof record[key] !== 'undefined')
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)

  return `{${properties.join(',')}}`
}

function createOperationNetUid(): string {
  const cryptoApi = globalThis.crypto
  const generated = cryptoApi?.randomUUID?.()

  if (generated && GUID_PATTERN.test(generated)) {
    return generated.toLowerCase()
  }

  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new CartReservationOperationStorageError()
  }

  const bytes = new Uint8Array(16)
  cryptoApi.getRandomValues(bytes)

  if (bytes.every((value) => value === 0)) {
    throw new CartReservationOperationStorageError()
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(
    bytes,
    (value) => value.toString(16).padStart(2, '0'),
  ).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}
