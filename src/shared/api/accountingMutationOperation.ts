import { ApiError } from './apiClient'
import { readSession } from '../auth/session'

export const ACCOUNTING_IDEMPOTENCY_HEADER = 'Idempotency-Key'
export const ACCOUNTING_MUTATION_LEDGER_STATE_HEADER = 'X-Mutation-Ledger-State'
export const ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED = 'not-entered'

export type AccountingMutationFailureStatus = 'definitive-failure' | 'unknown-outcome'

export type AccountingMutationOperationOptions = {
  operationId?: string
  signal?: AbortSignal
}

type AccountingMutationRequestContext = {
  headers: HeadersInit
  operationId: string
  signal?: AbortSignal
}

type ExecuteAccountingMutationOptions<TPayload, TResult> = {
  identity?: object
  kind: string
  operation?: AccountingMutationOperationOptions
  payload: TPayload
  request: (
    payloadSnapshot: TPayload,
    context: AccountingMutationRequestContext,
  ) => Promise<TResult>
}

type PendingAccountingMutation<TPayload> = {
  canonicalPayload: string
  identities: Set<object>
  inFlight?: Promise<unknown>
  kind: string
  operationId: string
  payloadSignature: string
  payloadSnapshot: TPayload
}

const ACCOUNTING_MUTATION_STORAGE_KEY = 'gba:accounting-mutation-operations:v1'
const pendingByOperationId = new Map<string, PendingAccountingMutation<unknown>>()
const pendingByCanonicalPayload = new Map<string, PendingAccountingMutation<unknown>>()
const pendingByIdentity = new WeakMap<object, PendingAccountingMutation<unknown>>()
const pendingResolutionByCanonicalPayload = new Map<
  string,
  Promise<PendingAccountingMutation<unknown>>
>()

export async function executeAccountingMutation<TPayload, TResult>({
  identity,
  kind,
  operation,
  payload,
  request,
}: ExecuteAccountingMutationOptions<TPayload, TResult>): Promise<TResult> {
  const candidateSnapshot = snapshotImmutableAccountingPayload(payload)
  const canonicalPayload = createCanonicalPayload(
    kind,
    candidateSnapshot,
    getAccountingUserScope(),
  )
  const pending = await resolvePendingMutation(
    kind,
    candidateSnapshot,
    canonicalPayload,
    identity,
    operation?.operationId,
  )

  if (pending.inFlight) {
    return pending.inFlight as Promise<TResult>
  }

  const execution = requestPendingAccountingMutation(
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

export function createAccountingMutationOperationId(
  randomUuid?: () => string,
): string {
  const createUuid = randomUuid ?? globalThis.crypto?.randomUUID?.bind(globalThis.crypto)

  if (!createUuid) {
    throw new Error('Secure UUID generation is unavailable')
  }

  return normalizeAccountingOperationId(createUuid())
}

export function getAccountingMutationHeaders(operationId: string): HeadersInit {
  return {
    [ACCOUNTING_IDEMPOTENCY_HEADER]: normalizeAccountingOperationId(operationId),
  }
}

export function clearPendingAccountingMutation(operationId: string): boolean {
  const normalized = normalizeAccountingOperationId(operationId)
  const pending = pendingByOperationId.get(normalized)

  if (!pending) {
    return false
  }

  clearPendingMutation(pending)

  return true
}

export function snapshotImmutableAccountingPayload<T>(payload: T): T {
  const serialized = JSON.stringify(payload)

  if (typeof serialized !== 'string') {
    throw new Error('Accounting mutation payload must be JSON serializable')
  }

  return deepFreeze(JSON.parse(serialized) as T)
}

/** A failure is definitive only when a 4xx response explicitly proves that the
 * request did not enter the accounting mutation ledger. Network failures,
 * aborts, unmarked 4xx responses, and all 5xx responses keep the operation key
 * and immutable payload snapshot pending for a safe retry.
 */
export function classifyAccountingMutationFailure(
  error: unknown,
): AccountingMutationFailureStatus {
  if (!(error instanceof ApiError) || error.status < 400 || error.status >= 500) {
    return 'unknown-outcome'
  }

  const headerState = normalizeLedgerState(
    error.headers.get(ACCOUNTING_MUTATION_LEDGER_STATE_HEADER),
  )
  const payloadState = getMutationLedgerState(error.payload)

  return headerState === ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED ||
    payloadState === ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED
    ? 'definitive-failure'
    : 'unknown-outcome'
}

async function resolvePendingMutation<TPayload>(
  kind: string,
  payloadSnapshot: TPayload,
  canonicalPayload: string,
  identity: object | undefined,
  requestedOperationId: string | undefined,
): Promise<PendingAccountingMutation<TPayload>> {
  const operationId = requestedOperationId
    ? normalizeAccountingOperationId(requestedOperationId)
    : undefined
  const existing = findPendingMutation(
    kind,
    canonicalPayload,
    identity,
    operationId,
  )

  if (existing) {
    return existing as PendingAccountingMutation<TPayload>
  }

  const resolving = pendingResolutionByCanonicalPayload.get(canonicalPayload)

  if (resolving) {
    const pending = await resolving

    return claimPendingMutation(
      pending,
      kind,
      canonicalPayload,
      identity,
      operationId,
    ) as PendingAccountingMutation<TPayload>
  }

  const resolution = createPendingMutation(
    kind,
    payloadSnapshot,
    canonicalPayload,
    identity,
    operationId,
  ) as Promise<PendingAccountingMutation<unknown>>
  pendingResolutionByCanonicalPayload.set(canonicalPayload, resolution)

  try {
    const pending = await resolution

    return claimPendingMutation(
      pending,
      kind,
      canonicalPayload,
      identity,
      operationId,
    ) as PendingAccountingMutation<TPayload>
  } finally {
    if (pendingResolutionByCanonicalPayload.get(canonicalPayload) === resolution) {
      pendingResolutionByCanonicalPayload.delete(canonicalPayload)
    }
  }
}

async function createPendingMutation<TPayload>(
  kind: string,
  payloadSnapshot: TPayload,
  canonicalPayload: string,
  identity: object | undefined,
  operationId: string | undefined,
): Promise<PendingAccountingMutation<TPayload>> {
  const payloadSignature = await hashCanonicalPayload(canonicalPayload)
  const concurrentlyRegistered = findPendingMutation(
    kind,
    canonicalPayload,
    identity,
    operationId,
  )

  if (concurrentlyRegistered) {
    return concurrentlyRegistered as PendingAccountingMutation<TPayload>
  }

  const persistedOperationId = readPersistedOperationId(payloadSignature)

  if (
    operationId &&
    persistedOperationId &&
    operationId !== persistedOperationId
  ) {
    throw new Error(
      'The accounting payload is already pending under a different operation id',
    )
  }

  return registerPendingMutation({
    canonicalPayload,
    identities: new Set(identity ? [identity] : []),
    kind,
    operationId:
      operationId ??
      persistedOperationId ??
      createAccountingMutationOperationId(),
    payloadSignature,
    payloadSnapshot,
  })
}

async function requestPendingAccountingMutation<TPayload, TResult>(
  pending: PendingAccountingMutation<TPayload>,
  signal: AbortSignal | undefined,
  request: (
    payloadSnapshot: TPayload,
    context: AccountingMutationRequestContext,
  ) => Promise<TResult>,
): Promise<TResult> {
  try {
    const result = await request(pending.payloadSnapshot, {
      headers: getAccountingMutationHeaders(pending.operationId),
      operationId: pending.operationId,
      ...(signal ? { signal } : {}),
    })

    clearPendingMutation(pending)

    return result
  } catch (error) {
    if (classifyAccountingMutationFailure(error) === 'definitive-failure') {
      clearPendingMutation(pending)
    }

    throw error
  }
}

function registerPendingMutation<TPayload>(
  pending: PendingAccountingMutation<TPayload>,
): PendingAccountingMutation<TPayload> {
  const existing = pendingByOperationId.get(pending.operationId)

  if (existing) {
    return claimPendingMutation(
      existing,
      pending.kind,
      pending.canonicalPayload,
      pending.identities.values().next().value,
      pending.operationId,
    ) as PendingAccountingMutation<TPayload>
  }

  pendingByOperationId.set(
    pending.operationId,
    pending as PendingAccountingMutation<unknown>,
  )
  pendingByCanonicalPayload.set(
    pending.canonicalPayload,
    pending as PendingAccountingMutation<unknown>,
  )

  for (const identity of pending.identities) {
    pendingByIdentity.set(
      identity,
      pending as PendingAccountingMutation<unknown>,
    )
  }
  persistOperationIdentity(pending.payloadSignature, pending.operationId)

  return pending
}

function clearPendingMutation(pending: PendingAccountingMutation<unknown>) {
  if (pendingByOperationId.get(pending.operationId) === pending) {
    pendingByOperationId.delete(pending.operationId)
  }

  if (pendingByCanonicalPayload.get(pending.canonicalPayload) === pending) {
    pendingByCanonicalPayload.delete(pending.canonicalPayload)
  }

  for (const identity of pending.identities) {
    if (pendingByIdentity.get(identity) === pending) {
      pendingByIdentity.delete(identity)
    }
  }
  pending.identities.clear()
  removePersistedOperationIdentity(
    pending.payloadSignature,
    pending.operationId,
  )
}

function assertSameMutation(
  pending: PendingAccountingMutation<unknown>,
  kind: string,
  canonicalPayload: string,
) {
  if (pending.kind !== kind || pending.canonicalPayload !== canonicalPayload) {
    throw new Error(
      'The accounting operation id is already pending with a different immutable payload',
    )
  }
}

function findPendingMutation(
  kind: string,
  canonicalPayload: string,
  identity: object | undefined,
  operationId: string | undefined,
): PendingAccountingMutation<unknown> | undefined {
  if (operationId) {
    const byOperationId = pendingByOperationId.get(operationId)

    if (byOperationId) {
      return claimPendingMutation(
        byOperationId,
        kind,
        canonicalPayload,
        identity,
        operationId,
      )
    }
  }

  if (identity) {
    const byIdentity = pendingByIdentity.get(identity)

    if (byIdentity) {
      return claimPendingMutation(
        byIdentity,
        kind,
        canonicalPayload,
        identity,
        operationId,
      )
    }
  }

  const byCanonicalPayload = pendingByCanonicalPayload.get(canonicalPayload)

  return byCanonicalPayload
    ? claimPendingMutation(
      byCanonicalPayload,
      kind,
      canonicalPayload,
      identity,
      operationId,
    )
    : undefined
}

function claimPendingMutation(
  pending: PendingAccountingMutation<unknown>,
  kind: string,
  canonicalPayload: string,
  identity: object | undefined,
  requestedOperationId: string | undefined,
): PendingAccountingMutation<unknown> {
  assertSameMutation(pending, kind, canonicalPayload)

  if (
    requestedOperationId &&
    pending.operationId !== requestedOperationId
  ) {
    throw new Error(
      'The accounting payload is already pending under a different operation id',
    )
  }

  if (identity) {
    pending.identities.add(identity)
    pendingByIdentity.set(identity, pending)
  }

  return pending
}

function createCanonicalPayload(
  kind: string,
  payload: unknown,
  userScope: string,
): string {
  const normalizedKind = kind.trim()

  if (!normalizedKind) {
    throw new Error('Accounting mutation kind is required')
  }

  return [
    `${userScope.length}:${userScope}`,
    `${normalizedKind.length}:${normalizedKind}`,
    stableStringify(payload),
  ].join(':')
}

async function hashCanonicalPayload(canonicalPayload: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure accounting payload hashing is unavailable')
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalPayload),
  )

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')).join('')
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const properties = Object.keys(record)
      .filter((key) => typeof record[key] !== 'undefined')
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)

    return `{${properties.join(',')}}`
  }

  const serialized = JSON.stringify(value)

  if (typeof serialized !== 'string') {
    throw new Error('Accounting mutation payload contains an unsupported value')
  }

  return serialized
}

function normalizeAccountingOperationId(operationId: string): string {
  const normalized = operationId.trim().toLowerCase()

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      normalized,
    ) ||
    normalized === '00000000-0000-0000-0000-000000000000'
  ) {
    throw new Error('OperationNetUid must be a non-empty UUID')
  }

  return normalized
}

function getMutationLedgerState(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ''
  }

  return normalizeLedgerState(
    (payload as { MutationLedgerState?: unknown }).MutationLedgerState,
  )
}

function normalizeLedgerState(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function readPersistedOperationId(payloadSignature: string): string | undefined {
  const identities = readPersistedOperationIdentities()
  const operationId = identities[payloadSignature]

  if (!operationId) {
    return undefined
  }

  try {
    return normalizeAccountingOperationId(operationId)
  } catch {
    removePersistedOperationIdentity(payloadSignature, operationId)

    return undefined
  }
}

function persistOperationIdentity(
  payloadSignature: string,
  operationId: string,
) {
  const storage = getSessionStorage()

  if (!storage) {
    return
  }

  try {
    const identities = readPersistedOperationIdentities()
    identities[payloadSignature] = operationId
    storage.setItem(
      ACCOUNTING_MUTATION_STORAGE_KEY,
      JSON.stringify(identities),
    )
  } catch {
    // Storage is an availability aid. The in-memory registry remains fail-closed.
  }
}

function removePersistedOperationIdentity(
  payloadSignature: string,
  operationId: string,
) {
  const storage = getSessionStorage()

  if (!storage) {
    return
  }

  try {
    const identities = readPersistedOperationIdentities()

    if (identities[payloadSignature] !== operationId) {
      return
    }

    delete identities[payloadSignature]

    if (Object.keys(identities).length === 0) {
      storage.removeItem(ACCOUNTING_MUTATION_STORAGE_KEY)
    } else {
      storage.setItem(
        ACCOUNTING_MUTATION_STORAGE_KEY,
        JSON.stringify(identities),
      )
    }
  } catch {
    // Keep the in-memory operation even when browser storage is unavailable.
  }
}

function readPersistedOperationIdentities(): Record<string, string> {
  const storage = getSessionStorage()

  if (!storage) {
    return {}
  }

  try {
    const serialized = storage.getItem(ACCOUNTING_MUTATION_STORAGE_KEY)

    if (!serialized) {
      return {}
    }

    const value = JSON.parse(serialized) as unknown

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(value).filter(
        ([signature, operationId]) =>
          /^[0-9a-f]{64}$/.test(signature) &&
          typeof operationId === 'string',
      ),
    )
  } catch {
    return {}
  }
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

function getAccountingUserScope(): string {
  try {
    const session = readSession()
    const userNetUid =
      session?.userNetUid?.trim().toLowerCase() ||
      session?.user?.NetUid?.trim().toLowerCase()

    if (userNetUid) {
      return `user:${userNetUid}`
    }

    if (session?.user?.Id) {
      return `user-id:${session.user.Id}`
    }
  } catch {
    // An unavailable browser store is represented by a distinct anonymous scope.
  }

  return 'user:anonymous'
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)

  for (const nested of Object.values(value)) {
    deepFreeze(nested)
  }

  return value
}
