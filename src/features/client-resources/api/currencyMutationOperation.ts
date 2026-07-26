import { ApiError } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
import type { ClientResourceCurrency } from '../types'

type PendingCurrencyCreate = {
  operationId: string
  signature: string
}

export type PreparedCurrencyCreateOperation = {
  operationId: string
  storageKey: string
}

type CurrencyCreateOperationDependencies = {
  createOperationId?: () => string
  digest?: (value: ArrayBuffer) => Promise<string>
  getStorage?: () => Storage | null
  getUserScope?: () => string
}

const STORAGE_KEY_PREFIX = 'gba:currency-create:v1'
const GUID_PATTERN =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[1-5][0-9a-f]{3}-?[89ab][0-9a-f]{3}-?[0-9a-f]{12}$/i

export function createCurrencyCreateOperation(
  dependencies: CurrencyCreateOperationDependencies = {},
) {
  const pendingByStorageKey = new Map<string, PendingCurrencyCreate>()
  const preparationTails = new Map<string, Promise<void>>()
  const createOperationId =
    dependencies.createOperationId ?? createSecureOperationId
  const digest = dependencies.digest ?? sha256
  const getStorage = dependencies.getStorage ?? getSessionStorage
  const getUserScope = dependencies.getUserScope ?? readUserScope

  return {
    async prepare(
      currency: ClientResourceCurrency,
    ): Promise<PreparedCurrencyCreateOperation> {
      const storageKey = `${STORAGE_KEY_PREFIX}:${getUserScope()}`
      const signature = await createPayloadSignature(currency, digest)

      return withPreparationLock(storageKey, preparationTails, () => {
        const pending =
          pendingByStorageKey.get(storageKey) ??
          readPersistedOperation(storageKey, getStorage)

        if (pending) {
          pendingByStorageKey.set(storageKey, pending)
          if (pending.signature !== signature) {
            throw new Error(
              'Результат попереднього створення валюти ще не підтверджено. Повторіть його без зміни даних.',
            )
          }

          return {
            operationId: pending.operationId,
            storageKey,
          }
        }

        const operationId = normalizeOperationId(createOperationId())
        if (!isValidOperationId(operationId)) {
          throw new Error('Не вдалося створити ідентифікатор операції')
        }

        const nextPending = {
          operationId,
          signature,
        }
        pendingByStorageKey.set(storageKey, nextPending)
        persistOperation(storageKey, nextPending, getStorage)

        return { operationId, storageKey }
      })
    },
    complete(operation: PreparedCurrencyCreateOperation) {
      clearOperation(operation, pendingByStorageKey, getStorage)
    },
    handleFailure(
      operation: PreparedCurrencyCreateOperation,
      error: unknown,
    ) {
      if (isDefinitiveFailure(error)) {
        clearOperation(operation, pendingByStorageKey, getStorage)
      }
    },
  }
}

export const currencyCreateOperation =
  createCurrencyCreateOperation()

async function createPayloadSignature(
  currency: ClientResourceCurrency,
  digest: (value: ArrayBuffer) => Promise<string>,
): Promise<string> {
  if (!currency || typeof currency !== 'object') {
    throw new Error('Дані валюти відсутні')
  }

  const bytes = new TextEncoder().encode(stableStringify(currency))
  return digest(bytes.buffer)
}

async function withPreparationLock<T>(
  storageKey: string,
  tails: Map<string, Promise<void>>,
  action: () => T | Promise<T>,
): Promise<T> {
  const previous = tails.get(storageKey) ?? Promise.resolve()
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => gate)
  tails.set(storageKey, tail)

  await previous
  try {
    return await action()
  } finally {
    release()
    if (tails.get(storageKey) === tail) {
      tails.delete(storageKey)
    }
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, nestedValue]) =>
          `${JSON.stringify(key)}:${stableStringify(nestedValue)}`,
      )
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(value)
}

async function sha256(value: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure digest generation is unavailable')
  }

  const hash = await globalThis.crypto.subtle.digest('SHA-256', value)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function createSecureOperationId(): string {
  const createUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)
  if (!createUuid) {
    throw new Error('Secure UUID generation is unavailable')
  }

  return createUuid()
}

function clearOperation(
  operation: PreparedCurrencyCreateOperation,
  pendingByStorageKey: Map<string, PendingCurrencyCreate>,
  getStorage: () => Storage | null,
) {
  const pending =
    pendingByStorageKey.get(operation.storageKey) ??
    readPersistedOperation(operation.storageKey, getStorage)
  if (pending?.operationId !== operation.operationId) {
    return
  }

  pendingByStorageKey.delete(operation.storageKey)
  try {
    getStorage()?.removeItem(operation.storageKey)
  } catch {
    // The in-memory operation is already settled.
  }
}

function readPersistedOperation(
  storageKey: string,
  getStorage: () => Storage | null,
): PendingCurrencyCreate | null {
  try {
    const serialized = getStorage()?.getItem(storageKey)
    if (!serialized) {
      return null
    }

    const candidate = JSON.parse(serialized) as Partial<PendingCurrencyCreate>
    const operationId = normalizeOperationId(candidate.operationId)
    if (
      !isValidOperationId(operationId) ||
      typeof candidate.signature !== 'string' ||
      !candidate.signature
    ) {
      getStorage()?.removeItem(storageKey)
      return null
    }

    return {
      operationId,
      signature: candidate.signature,
    }
  } catch {
    return null
  }
}

function persistOperation(
  storageKey: string,
  pending: PendingCurrencyCreate,
  getStorage: () => Storage | null,
) {
  try {
    getStorage()?.setItem(storageKey, JSON.stringify(pending))
  } catch {
    // The in-memory operation remains fail-closed.
  }
}

function isDefinitiveFailure(error: unknown): boolean {
  const status =
    error instanceof ApiError
      ? error.status
      : error &&
          typeof error === 'object' &&
          'status' in error &&
          typeof error.status === 'number'
        ? error.status
        : null

  return (
    status !== null &&
    status >= 400 &&
    status < 500 &&
    status !== 408
  )
}

function normalizeOperationId(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function isValidOperationId(value: string): boolean {
  return (
    GUID_PATTERN.test(value) &&
    value.replaceAll('-', '') !==
      '00000000000000000000000000000000'
  )
}

function readUserScope(): string {
  try {
    const session = readSession()
    const userNetUid =
      session?.userNetUid?.trim().toLowerCase() ||
      session?.user?.NetUid?.trim().toLowerCase()

    if (userNetUid) {
      return `user-${userNetUid}`
    }

    if (session?.user?.Id) {
      return `user-id-${session.user.Id}`
    }
  } catch {
    // Use an isolated anonymous scope when auth storage is unavailable.
  }

  return 'anonymous'
}

function getSessionStorage(): Storage | null {
  try {
    return typeof globalThis.sessionStorage === 'undefined'
      ? null
      : globalThis.sessionStorage
  } catch {
    return null
  }
}
