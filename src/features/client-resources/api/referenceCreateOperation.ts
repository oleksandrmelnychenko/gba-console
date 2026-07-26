import { ApiError } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'

type PendingReferenceCreate = {
  operationId: string
  signature: string
}

export type PreparedReferenceCreateOperation = {
  operationId: string
  storageKey: string
}

type ReferenceCreateOperationDependencies = {
  createOperationId?: () => string
  digest?: (value: ArrayBuffer) => Promise<string>
  getStorage?: () => Storage | null
  getUserScope?: () => string
}

const STORAGE_KEY_PREFIX = 'gba:reference-create:v1'
const GUID_PATTERN =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[1-5][0-9a-f]{3}-?[89ab][0-9a-f]{3}-?[0-9a-f]{12}$/i

export function createReferenceCreateOperation(
  resourceKind: 'region' | 'region-code',
  dependencies: ReferenceCreateOperationDependencies = {},
) {
  const pendingByStorageKey = new Map<string, PendingReferenceCreate>()
  const createOperationId =
    dependencies.createOperationId ?? createSecureOperationId
  const digest = dependencies.digest ?? sha256
  const getStorage = dependencies.getStorage ?? getSessionStorage
  const getUserScope = dependencies.getUserScope ?? readUserScope
  const preparationTails = new Map<string, Promise<void>>()

  return {
    async prepare(payload: unknown): Promise<PreparedReferenceCreateOperation> {
      const storageKey =
        `${STORAGE_KEY_PREFIX}:${resourceKind}:${getUserScope()}`
      const signature = await createPayloadSignature(payload, digest)

      return withPreparationLock(storageKey, preparationTails, () => {
        const pending =
          pendingByStorageKey.get(storageKey) ??
          readPersistedOperation(storageKey, getStorage)

        if (pending) {
          pendingByStorageKey.set(storageKey, pending)
          if (pending.signature !== signature) {
            throw new Error(
              'Результат попереднього створення ще не підтверджено. Повторіть операцію без зміни даних.',
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

        const nextPending = { operationId, signature }
        pendingByStorageKey.set(storageKey, nextPending)
        persistOperation(storageKey, nextPending, getStorage)
        return { operationId, storageKey }
      })
    },
    complete(operation: PreparedReferenceCreateOperation) {
      clearOperation(operation, pendingByStorageKey, getStorage)
    },
    handleFailure(
      operation: PreparedReferenceCreateOperation,
      error: unknown,
    ) {
      if (isDefinitiveFailure(error)) {
        clearOperation(operation, pendingByStorageKey, getStorage)
      }
    },
  }
}

export const regionCreateOperation =
  createReferenceCreateOperation('region')

export const regionCodeCreateOperation =
  createReferenceCreateOperation('region-code')

async function createPayloadSignature(
  payload: unknown,
  digest: (value: ArrayBuffer) => Promise<string>,
): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(payload))
  return digest(bytes.buffer)
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

async function sha256(value: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure digest generation is unavailable')
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', value)
  return Array.from(new Uint8Array(digest))
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
  operation: PreparedReferenceCreateOperation,
  pendingByStorageKey: Map<string, PendingReferenceCreate>,
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
): PendingReferenceCreate | null {
  try {
    const serialized = getStorage()?.getItem(storageKey)
    if (!serialized) {
      return null
    }

    const candidate = JSON.parse(serialized) as Partial<PendingReferenceCreate>
    const operationId = normalizeOperationId(candidate.operationId)
    if (
      !isValidOperationId(operationId) ||
      typeof candidate.signature !== 'string'
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
  pending: PendingReferenceCreate,
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
