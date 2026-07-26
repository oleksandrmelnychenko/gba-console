import { readSession } from '../../../shared/auth/session'

const STORAGE_KEY_PREFIX = 'gba:product-groups:create:v1'
const LEDGER_STATE_HEADER = 'X-ProductGroup-Create-Ledger-State'
const LEDGER_STATE_COMPLETED = 'completed'
const LEDGER_STATE_DEFINITIVE_NO_WRITE = 'definitive-no-write'
const LEDGER_STATE_UNKNOWN = 'unknown'
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PendingProductGroupCreateOperation = {
  fingerprint: string
  operationNetUid: string
}

export class ProductGroupCreateRetryConflictError extends Error {
  constructor() {
    super(
      'Попереднє створення групи має невідомий результат. Повторіть незмінений запит перед створенням іншої групи.',
    )
    this.name = 'ProductGroupCreateRetryConflictError'
  }
}

export class ProductGroupCreateOperationStorageError extends Error {
  constructor() {
    super('Не вдалося безпечно зберегти ідентифікатор операції створення групи.')
    this.name = 'ProductGroupCreateOperationStorageError'
  }
}

export function acquireProductGroupCreateOperation(
  request: unknown,
): PendingProductGroupCreateOperation {
  const storage = getStorage()
  const storageKey = getStorageKey()
  const fingerprint = stableSerialize(request)
  const persisted = readPendingOperation(storage, storageKey)

  if (persisted) {
    if (persisted.fingerprint !== fingerprint) {
      throw new ProductGroupCreateRetryConflictError()
    }

    return persisted
  }

  const pending: PendingProductGroupCreateOperation = {
    fingerprint,
    operationNetUid: createOperationNetUid(),
  }

  try {
    storage.setItem(storageKey, JSON.stringify(pending))
    const confirmed = readPendingOperation(storage, storageKey)

    if (
      !confirmed
      || confirmed.operationNetUid !== pending.operationNetUid
      || confirmed.fingerprint !== pending.fingerprint
    ) {
      throw new ProductGroupCreateOperationStorageError()
    }
  } catch (error) {
    if (error instanceof ProductGroupCreateOperationStorageError) {
      throw error
    }

    throw new ProductGroupCreateOperationStorageError()
  }

  return pending
}

export function clearProductGroupCreateOperation(
  operationNetUid: string,
) {
  try {
    const storage = getStorage()
    const storageKey = getStorageKey()
    const persisted = readPendingOperation(storage, storageKey)

    if (persisted?.operationNetUid === operationNetUid) {
      storage.removeItem(storageKey)
    }
  } catch {
    // A confirmed server response remains authoritative if local cleanup fails.
  }
}

export function isDefinitiveProductGroupCreateFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return false
  }

  const ledgerState = readLedgerState(error)

  if (ledgerState === LEDGER_STATE_UNKNOWN) {
    return false
  }

  if (
    ledgerState === LEDGER_STATE_COMPLETED
    || ledgerState === LEDGER_STATE_DEFINITIVE_NO_WRITE
  ) {
    return true
  }

  const status = Number(error.status)
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 408
}

function getStorage(): Storage {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      throw new ProductGroupCreateOperationStorageError()
    }

    return globalThis.localStorage
  } catch {
    throw new ProductGroupCreateOperationStorageError()
  }
}

function getStorageKey(): string {
  const userNetUid = readSession()?.userNetUid?.trim().toLowerCase()

  if (!userNetUid || !GUID_PATTERN.test(userNetUid)) {
    throw new ProductGroupCreateOperationStorageError()
  }

  return `${STORAGE_KEY_PREFIX}:${userNetUid}`
}

function readPendingOperation(
  storage: Storage,
  storageKey: string,
): PendingProductGroupCreateOperation | null {
  let raw: string | null

  try {
    raw = storage.getItem(storageKey)
  } catch {
    throw new ProductGroupCreateOperationStorageError()
  }

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingProductGroupCreateOperation>

    if (
      typeof parsed.fingerprint !== 'string'
      || typeof parsed.operationNetUid !== 'string'
      || !GUID_PATTERN.test(parsed.operationNetUid)
    ) {
      throw new ProductGroupCreateOperationStorageError()
    }

    return {
      fingerprint: parsed.fingerprint,
      operationNetUid: parsed.operationNetUid.toLowerCase(),
    }
  } catch (error) {
    if (error instanceof ProductGroupCreateOperationStorageError) {
      throw error
    }

    throw new ProductGroupCreateOperationStorageError()
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
    return `[${value.map(stableSerialize).sort().join(',')}]`
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
    throw new ProductGroupCreateOperationStorageError()
  }

  const bytes = new Uint8Array(16)
  cryptoApi.getRandomValues(bytes)

  if (bytes.every((value) => value === 0)) {
    throw new ProductGroupCreateOperationStorageError()
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

function readLedgerState(error: object): string | null {
  if (!('headers' in error)) {
    return null
  }

  try {
    return new Headers(error.headers as HeadersInit)
      .get(LEDGER_STATE_HEADER)
      ?.trim()
      .toLowerCase() || null
  } catch {
    return null
  }
}
