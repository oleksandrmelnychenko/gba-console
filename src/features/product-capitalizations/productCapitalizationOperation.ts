import { ApiError } from '../../shared/api/apiClient'
import { readSession } from '../../shared/auth/session'
import { toProductCapitalizationCreateWirePayload } from './productCapitalizationPayload'
import type {
  ProductCapitalizationCreatePayload,
  ProductCapitalizationCreateWirePayload,
} from './types'

export const PRODUCT_CAPITALIZATION_IDEMPOTENCY_HEADER =
  'Idempotency-Key'
export const PRODUCT_CAPITALIZATION_OWNER_HEADER =
  'X-Product-Capitalization-Owner'
export const PRODUCT_CAPITALIZATION_LEDGER_STATE_HEADER =
  'X-Product-Capitalization-Ledger-State'
export const PRODUCT_CAPITALIZATION_LEDGER_NOT_ENTERED =
  'not-entered'
export const PRODUCT_CAPITALIZATION_LEDGER_ROLLED_BACK =
  'rolled-back'

export type ProductCapitalizationMutationFailureStatus =
  'definitive-failure' | 'unknown-outcome'

export type ProductCapitalizationMutationOperationOptions = {
  identity?: object
  operationId?: string
  signal?: AbortSignal
}

export type ProductCapitalizationMutationRequestContext = {
  headers: HeadersInit
  operationId: string
  ownerNetUid: string
  signal?: AbortSignal
}

export type PendingProductCapitalizationOperation = {
  operationId: string
  ownerNetUid: string
  payload: ProductCapitalizationCreateWirePayload
}

type ExecuteProductCapitalizationMutationOptions<TResult> = {
  operation?: ProductCapitalizationMutationOperationOptions
  payload: ProductCapitalizationCreatePayload
  request: (
    payloadSnapshot: ProductCapitalizationCreateWirePayload,
    context: ProductCapitalizationMutationRequestContext,
  ) => Promise<TResult>
}

type PendingMutation = PendingProductCapitalizationOperation & {
  identities: Set<object>
  inFlight?: Promise<unknown>
  signature: string
}

type PersistedPendingMutation = PendingProductCapitalizationOperation & {
  signature: string
  version: 1
}

const STORAGE_KEY_PREFIX =
  'gba:product-capitalization-operation:v1'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const pendingByOwner = new Map<string, PendingMutation>()
const pendingByOperationId = new Map<string, PendingMutation>()
const pendingByIdentity = new WeakMap<object, PendingMutation>()
const pendingResolutionByOwner =
  new Map<string, Promise<PendingMutation>>()

export async function executeProductCapitalizationMutation<TResult>({
  operation,
  payload,
  request,
}: ExecuteProductCapitalizationMutationOptions<TResult>): Promise<TResult> {
  const ownerNetUid = getAuthenticatedOwnerNetUid()
  const payloadSnapshot =
    toProductCapitalizationCreateWirePayload(payload)
  const pending = await resolvePendingMutation(
    ownerNetUid,
    payloadSnapshot,
    operation?.identity,
    operation?.operationId,
  )

  if (pending.inFlight) {
    return pending.inFlight as Promise<TResult>
  }

  const execution = requestPendingMutation(
    pending,
    operation?.signal,
    request,
  )
  pending.inFlight = execution

  try {
    return await execution
  } finally {
    if (pending.inFlight === execution) {
      pending.inFlight = undefined
    }
  }
}

export function getPendingProductCapitalizationOperation():
  PendingProductCapitalizationOperation | null {
  const ownerNetUid = getAuthenticatedOwnerNetUid()
  const pending =
    pendingByOwner.get(ownerNetUid)
    ?? readPersistedPendingSync(ownerNetUid)

  if (!pending) {
    return null
  }
  registerPending(pending)

  return {
    operationId: pending.operationId,
    ownerNetUid: pending.ownerNetUid,
    payload: pending.payload,
  }
}

export function classifyProductCapitalizationMutationFailure(
  error: unknown,
): ProductCapitalizationMutationFailureStatus {
  const apiError =
    readApiErrorContract(error)
  if (
    !apiError
    || apiError.status < 400
    || apiError.status >= 500
    || apiError.status === 408
  ) {
    return 'unknown-outcome'
  }

  const ledgerState = apiError.headers
    .get(PRODUCT_CAPITALIZATION_LEDGER_STATE_HEADER)
    ?.trim()
    .toLowerCase()

  return ledgerState ===
      PRODUCT_CAPITALIZATION_LEDGER_NOT_ENTERED
    || ledgerState ===
      PRODUCT_CAPITALIZATION_LEDGER_ROLLED_BACK
    ? 'definitive-failure'
    : 'unknown-outcome'
}

function readApiErrorContract(
  error: unknown,
): Pick<ApiError, 'headers' | 'status'> | null {
  if (error instanceof ApiError) {
    return error
  }
  if (
    !error
    || typeof error !== 'object'
    || typeof (error as { status?: unknown }).status !== 'number'
  ) {
    return null
  }

  const headers =
    (error as { headers?: unknown }).headers
  return headers instanceof Headers
    ? {
      headers,
      status: (error as { status: number }).status,
    }
    : null
}

async function resolvePendingMutation(
  ownerNetUid: string,
  payloadSnapshot: ProductCapitalizationCreateWirePayload,
  identity: object | undefined,
  requestedOperationId: string | undefined,
): Promise<PendingMutation> {
  const operationId = requestedOperationId
    ? normalizeUuid(requestedOperationId, 'operation')
    : undefined
  const signature =
    await createPayloadSignature(ownerNetUid, payloadSnapshot)
  const identityPending =
    identity ? pendingByIdentity.get(identity) : undefined

  if (identityPending) {
    return claimPending(
      identityPending,
      ownerNetUid,
      signature,
      identity,
      operationId,
    )
  }

  const resolving =
    pendingResolutionByOwner.get(ownerNetUid)
  if (resolving) {
    return claimPending(
      await resolving,
      ownerNetUid,
      signature,
      identity,
      operationId,
    )
  }

  const resolution = resolveOrCreatePending(
    ownerNetUid,
    payloadSnapshot,
    signature,
    operationId,
  )
  pendingResolutionByOwner.set(ownerNetUid, resolution)

  try {
    return claimPending(
      await resolution,
      ownerNetUid,
      signature,
      identity,
      operationId,
    )
  } finally {
    if (
      pendingResolutionByOwner.get(ownerNetUid)
      === resolution
    ) {
      pendingResolutionByOwner.delete(ownerNetUid)
    }
  }
}

async function resolveOrCreatePending(
  ownerNetUid: string,
  payloadSnapshot: ProductCapitalizationCreateWirePayload,
  signature: string,
  operationId: string | undefined,
): Promise<PendingMutation> {
  const byOperationId = operationId
    ? pendingByOperationId.get(operationId)
      ?? findPersistedByOperationId(operationId)
    : undefined
  if (byOperationId) {
    return byOperationId
  }

  const byOwner =
    pendingByOwner.get(ownerNetUid)
    ?? await readPersistedPending(ownerNetUid)
  if (byOwner) {
    return byOwner
  }

  const pending: PendingMutation = {
    identities: new Set(),
    operationId:
      operationId ?? createOperationId(),
    ownerNetUid,
    payload: payloadSnapshot,
    signature,
  }
  persistPending(pending)
  registerPending(pending)

  return pending
}

function claimPending(
  pending: PendingMutation,
  ownerNetUid: string,
  signature: string,
  identity: object | undefined,
  requestedOperationId: string | undefined,
): PendingMutation {
  if (
    pending.ownerNetUid !== ownerNetUid
    || pending.signature !== signature
  ) {
    throw new Error(
      'The pending capitalization operation belongs to a different immutable payload or owner',
    )
  }
  if (
    requestedOperationId
    && pending.operationId !== requestedOperationId
  ) {
    throw new Error(
      'The capitalization payload is pending under a different operation id',
    )
  }

  if (identity) {
    pending.identities.add(identity)
    pendingByIdentity.set(identity, pending)
  }
  registerPending(pending)

  return pending
}

async function requestPendingMutation<TResult>(
  pending: PendingMutation,
  signal: AbortSignal | undefined,
  request: (
    payloadSnapshot: ProductCapitalizationCreateWirePayload,
    context: ProductCapitalizationMutationRequestContext,
  ) => Promise<TResult>,
): Promise<TResult> {
  if (getAuthenticatedOwnerNetUid() !== pending.ownerNetUid) {
    throw new Error(
      'Authenticated capitalization owner changed before the request was sent',
    )
  }
  persistPending(pending)

  try {
    const result = await request(
      pending.payload,
      {
        headers: {
          [PRODUCT_CAPITALIZATION_IDEMPOTENCY_HEADER]:
            pending.operationId,
          [PRODUCT_CAPITALIZATION_OWNER_HEADER]:
            pending.ownerNetUid,
        },
        operationId: pending.operationId,
        ownerNetUid: pending.ownerNetUid,
        ...(signal ? { signal } : {}),
      },
    )
    clearPendingMutation(pending)

    return result
  } catch (error) {
    if (
      classifyProductCapitalizationMutationFailure(error)
      === 'definitive-failure'
    ) {
      clearPendingMutation(pending)
    }

    throw error
  }
}

function registerPending(pending: PendingMutation) {
  pendingByOwner.set(pending.ownerNetUid, pending)
  pendingByOperationId.set(pending.operationId, pending)
  pending.identities.forEach((identity) =>
    pendingByIdentity.set(identity, pending))
}

function clearPendingMutation(pending: PendingMutation) {
  if (pendingByOwner.get(pending.ownerNetUid) === pending) {
    pendingByOwner.delete(pending.ownerNetUid)
  }
  if (
    pendingByOperationId.get(pending.operationId)
    === pending
  ) {
    pendingByOperationId.delete(pending.operationId)
  }
  pending.identities.forEach((identity) => {
    if (pendingByIdentity.get(identity) === pending) {
      pendingByIdentity.delete(identity)
    }
  })
  pending.identities.clear()
  removePersistedPending(
    pending.ownerNetUid,
    pending.operationId,
  )
}

async function readPersistedPending(
  ownerNetUid: string,
): Promise<PendingMutation | null> {
  const pending =
    readPersistedPendingSync(ownerNetUid)
  if (!pending) {
    return null
  }

  const expectedSignature =
    await createPayloadSignature(
      pending.ownerNetUid,
      pending.payload,
    )
  if (expectedSignature !== pending.signature) {
    removePersistedPending(
      pending.ownerNetUid,
      pending.operationId,
    )
    return null
  }

  registerPending(pending)
  return pending
}

function readPersistedPendingSync(
  ownerNetUid: string,
): PendingMutation | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }

  const storageKey = createStorageKey(ownerNetUid)
  try {
    const serialized = storage.getItem(storageKey)
    if (!serialized) {
      return null
    }

    const candidate =
      JSON.parse(serialized) as Partial<PersistedPendingMutation>
    if (
      candidate.version !== 1
      || normalizeUuid(candidate.ownerNetUid, 'owner')
        !== ownerNetUid
      || !SHA256_PATTERN.test(candidate.signature ?? '')
    ) {
      storage.removeItem(storageKey)
      return null
    }

    const operationId =
      normalizeUuid(candidate.operationId, 'operation')
    const payload =
      toProductCapitalizationCreateWirePayload(
        candidate.payload as ProductCapitalizationCreatePayload,
      )
    return {
      identities: new Set(),
      operationId,
      ownerNetUid,
      payload,
      signature: candidate.signature!,
    }
  } catch {
    storage.removeItem(storageKey)
    return null
  }
}

function findPersistedByOperationId(
  operationId: string,
): PendingMutation | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key?.startsWith(`${STORAGE_KEY_PREFIX}:`)) {
      continue
    }

    const ownerNetUid =
      key.slice(STORAGE_KEY_PREFIX.length + 1)
    try {
      const pending =
        readPersistedPendingSync(ownerNetUid)
      if (pending?.operationId === operationId) {
        return pending
      }
    } catch {
      // Invalid owner-scoped entries are removed by the strict reader.
    }
  }

  return null
}

function persistPending(pending: PendingMutation) {
  const storage = getSessionStorage()
  if (!storage) {
    throw new Error(
      'Persistent capitalization operation storage is unavailable',
    )
  }

  const persisted: PersistedPendingMutation = {
    operationId: pending.operationId,
    ownerNetUid: pending.ownerNetUid,
    payload: pending.payload,
    signature: pending.signature,
    version: 1,
  }
  try {
    storage.setItem(
      createStorageKey(pending.ownerNetUid),
      JSON.stringify(persisted),
    )
  } catch {
    throw new Error(
      'The capitalization operation could not be persisted before submission',
    )
  }
}

function removePersistedPending(
  ownerNetUid: string,
  operationId: string,
) {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }

  const storageKey = createStorageKey(ownerNetUid)
  try {
    const pending =
      readPersistedPendingSync(ownerNetUid)
    if (pending?.operationId === operationId) {
      storage.removeItem(storageKey)
    }
  } catch {
    // The in-memory operation is already settled.
  }
}

function createOperationId(): string {
  const randomUuid =
    globalThis.crypto?.randomUUID?.bind(globalThis.crypto)
  if (!randomUuid) {
    throw new Error(
      'Secure UUID generation is unavailable for capitalization',
    )
  }

  return normalizeUuid(randomUuid(), 'operation')
}

async function createPayloadSignature(
  ownerNetUid: string,
  payload: ProductCapitalizationCreateWirePayload,
): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Secure payload hashing is unavailable for capitalization',
    )
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      stableStringify({
        ownerNetUid,
        payload,
      }),
    ),
  )
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}

function getAuthenticatedOwnerNetUid(): string {
  const session = readSession()
  const ownerNetUid =
    session?.userNetUid
    ?? session?.user?.NetUid

  return normalizeUuid(ownerNetUid, 'owner')
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
      `Product capitalization ${name} must be a non-empty UUID`,
    )
  }

  return normalized
}

function createStorageKey(ownerNetUid: string): string {
  return `${STORAGE_KEY_PREFIX}:${ownerNetUid}`
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

function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const properties = Object.keys(record)
      .filter((key) => typeof record[key] !== 'undefined')
      .sort()
      .map((key) =>
        `${JSON.stringify(key)}:${stableStringify(record[key])}`)

    return `{${properties.join(',')}}`
  }

  const serialized = JSON.stringify(value)
  if (typeof serialized !== 'string') {
    throw new Error(
      'Product capitalization payload contains an unsupported value',
    )
  }

  return serialized
}
