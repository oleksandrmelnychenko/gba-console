import { ApiError } from './apiClient'
import { readSession } from '../auth/session'

export const SAD_IDEMPOTENCY_HEADER = 'Idempotency-Key'
export const SAD_LEDGER_STATE_HEADER = 'X-Sad-Mutation-Ledger-State'
export const SAD_LEDGER_NOT_ENTERED = 'not-entered'
export const SAD_LEDGER_ROLLED_BACK = 'rolled-back'

type SadIdentity = {
  Id?: number
}

export type SadMutationRequestContext = {
  headers?: HeadersInit
  isCreate: boolean
}

type ExecuteSadMutationOptions<TSad extends SadIdentity, TResult> = {
  request: (
    payload: TSad,
    context: SadMutationRequestContext,
  ) => Promise<TResult>
  sad: TSad
}

type PendingSadCreateOperation = {
  fingerprint: string
  operationNetUid: string
  ownerNetUid: string
  payload: SadIdentity
  version: 1
}

const STORAGE_PREFIX = 'gba:sad-create-mutation:v1'
const OPERATION_KIND = 'sad:create-cart:v1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const inFlightByOperation = new Map<string, Promise<unknown>>()

export async function executeSadMutation<
  TSad extends SadIdentity,
  TResult,
>({
  request,
  sad,
}: ExecuteSadMutationOptions<TSad, TResult>): Promise<TResult> {
  if (Number(sad.Id ?? 0) !== 0) {
    return request(sad, { isCreate: false })
  }

  const ownerNetUid = getAuthenticatedOwnerNetUid()
  const payload = snapshotJson(sad)
  const fingerprint = await sha256Text(stableJson({
    kind: OPERATION_KIND,
    ownerNetUid,
    payload,
  }))
  const pending = getOrCreatePendingOperation(
    ownerNetUid,
    fingerprint,
    payload,
  )

  if (getAuthenticatedOwnerNetUid() !== pending.ownerNetUid) {
    throw new Error(
      'Authenticated SAD owner changed before the request was sent.',
    )
  }

  const existingRequest = inFlightByOperation.get(
    pending.operationNetUid,
  )
  if (existingRequest) {
    return existingRequest as Promise<TResult>
  }

  const execution = request(
    pending.payload as TSad,
    {
      headers: {
        [SAD_IDEMPOTENCY_HEADER]:
          pending.operationNetUid,
      },
      isCreate: true,
    },
  )
    .then((result) => {
      clearPendingOperation(pending)
      return result
    })
    .catch((error: unknown) => {
      if (isDefinitiveSadMutationFailure(error)) {
        clearPendingOperation(pending)
      }
      throw error
    })
    .finally(() => {
      if (
        inFlightByOperation.get(
          pending.operationNetUid,
        ) === execution
      ) {
        inFlightByOperation.delete(
          pending.operationNetUid,
        )
      }
    })

  inFlightByOperation.set(
    pending.operationNetUid,
    execution,
  )
  return execution
}

export function isDefinitiveSadMutationFailure(
  error: unknown,
): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }

  const ledgerState = error.headers
    .get(SAD_LEDGER_STATE_HEADER)
    ?.trim()
    .toLowerCase()
  return ledgerState === SAD_LEDGER_NOT_ENTERED
    || ledgerState === SAD_LEDGER_ROLLED_BACK
}

function getOrCreatePendingOperation<TSad extends SadIdentity>(
  ownerNetUid: string,
  fingerprint: string,
  payload: TSad,
): PendingSadCreateOperation {
  const storage = requireDurableStorage()
  const storageKey = getStorageKey(ownerNetUid)
  const persisted = readPendingOperation(
    storage,
    storageKey,
  )

  if (persisted) {
    if (
      persisted.ownerNetUid !== ownerNetUid
      || persisted.fingerprint !== fingerprint
      || stableJson(persisted.payload)
        !== stableJson(payload)
    ) {
      throw new Error(
        'A cart-backed SAD with an unknown outcome is pending. Retry its immutable payload before creating another SAD.',
      )
    }

    return persisted
  }

  const pending: PendingSadCreateOperation = {
    fingerprint,
    operationNetUid: createOperationNetUid(),
    ownerNetUid,
    payload,
    version: 1,
  }
  const serialized = JSON.stringify(pending)

  try {
    storage.setItem(storageKey, serialized)
    if (storage.getItem(storageKey) !== serialized) {
      throw new Error(
        'SAD retry state verification failed.',
      )
    }
  } catch {
    throw new Error(
      'SAD retry state could not be persisted. The request was not sent.',
    )
  }

  return pending
}

function readPendingOperation(
  storage: Storage,
  storageKey: string,
): PendingSadCreateOperation | null {
  let serialized: string | null

  try {
    serialized = storage.getItem(storageKey)
  } catch {
    throw new Error(
      'SAD retry state could not be read. The request was not sent.',
    )
  }

  if (!serialized) {
    return null
  }

  try {
    const pending = JSON.parse(
      serialized,
    ) as Partial<PendingSadCreateOperation>
    if (
      pending.version !== 1
      || !isNonEmptyGuid(pending.operationNetUid)
      || !isNonEmptyGuid(pending.ownerNetUid)
      || typeof pending.fingerprint !== 'string'
      || !/^[0-9a-f]{64}$/i.test(
        pending.fingerprint,
      )
      || !pending.payload
      || typeof pending.payload !== 'object'
      || Array.isArray(pending.payload)
    ) {
      throw new Error('invalid SAD retry state')
    }

    return pending as PendingSadCreateOperation
  } catch {
    throw new Error(
      'Persisted SAD retry state is invalid. The request was not sent.',
    )
  }
}

function clearPendingOperation(
  pending: PendingSadCreateOperation,
) {
  try {
    const storage = requireDurableStorage()
    const storageKey = getStorageKey(
      pending.ownerNetUid,
    )
    const current = readPendingOperation(
      storage,
      storageKey,
    )
    if (
      current?.operationNetUid
      === pending.operationNetUid
    ) {
      storage.removeItem(storageKey)
    }
  } catch {
    // A definitive response remains authoritative if cleanup fails.
  }
}

function getAuthenticatedOwnerNetUid(): string {
  let session

  try {
    session = readSession()
  } catch {
    session = null
  }

  const ownerNetUid =
    session?.userNetUid || session?.user?.NetUid
  if (!isNonEmptyGuid(ownerNetUid?.trim())) {
    throw new Error(
      'Authenticated SAD owner identity is unavailable.',
    )
  }

  return ownerNetUid.trim().toLowerCase()
}

function requireDurableStorage(): Storage {
  try {
    if (
      typeof window !== 'undefined'
      && window.localStorage
    ) {
      return window.localStorage
    }
  } catch {
    // Fall through to the durable-storage error.
  }

  throw new Error(
    'Durable browser storage is required to create a SAD.',
  )
}

function getStorageKey(ownerNetUid: string): string {
  return `${STORAGE_PREFIX}:${ownerNetUid}`
}

function createOperationNetUid(): string {
  const operationNetUid =
    globalThis.crypto?.randomUUID?.()
  if (!isNonEmptyGuid(operationNetUid)) {
    throw new Error(
      'Secure SAD operation identity generation is unavailable.',
    )
  }

  return operationNetUid.toLowerCase()
}

function isNonEmptyGuid(
  value: unknown,
): value is string {
  return typeof value === 'string'
    && UUID_PATTERN.test(value)
    && value.toLowerCase()
      !== '00000000-0000-0000-0000-000000000000'
}

function snapshotJson<TSad extends SadIdentity>(
  sad: TSad,
): TSad {
  const serialized = JSON.stringify(sad)
  if (!serialized) {
    throw new Error(
      'The SAD payload is not serializable.',
    )
  }

  const snapshot = JSON.parse(serialized) as unknown
  if (
    !snapshot
    || typeof snapshot !== 'object'
    || Array.isArray(snapshot)
  ) {
    throw new Error('The SAD payload is invalid.')
  }

  return snapshot as TSad
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) =>
          typeof child !== 'undefined')
        .sort(([left], [right]) =>
          left.localeCompare(right))
        .map(([key, child]) => [
          key,
          sortJson(child),
        ]),
    )
  }

  return value
}

async function sha256Text(
  value: string,
): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Secure SAD payload hashing is unavailable.',
    )
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}
