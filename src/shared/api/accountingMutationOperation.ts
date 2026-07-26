import { ApiError, apiRequest } from './apiClient'
import { readSession } from '../auth/session'

export const ACCOUNTING_IDEMPOTENCY_HEADER = 'Idempotency-Key'
export const ACCOUNTING_MUTATION_LEDGER_STATE_HEADER = 'X-Mutation-Ledger-State'
export const ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED = 'not-entered'
export const ACCOUNTING_MUTATION_LEDGER_FINGERPRINT_CONFLICT =
  'fingerprint-conflict'

export type AccountingMutationFailureStatus = 'definitive-failure' | 'unknown-outcome'

export type AccountingMutationOperationOptions = {
  operationId?: string
  signal?: AbortSignal
}

export type AccountingMutationStatus = {
  OperationKind: string
  OperationNetUid: string
  ResultEntityKind?: string | null
  ResultEntityNetUid?: string | null
  State: 'completed' | 'pending'
  Updated?: string
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
  mutationScope: string
  mutationScopeSignature: string
  operationId: string
  payloadSignature: string
  payloadSnapshot: TPayload
}

type PersistedUnresolvedAccountingMutation = {
  operationId: string
  payloadSignature: string
}

const ACCOUNTING_MUTATION_STORAGE_KEY = 'gba:accounting-mutation-operations:v1'
const ACCOUNTING_MUTATION_UNRESOLVED_STORAGE_FIELD = 'unresolved'
const pendingByOperationId = new Map<string, PendingAccountingMutation<unknown>>()
const pendingByCanonicalPayload = new Map<string, PendingAccountingMutation<unknown>>()
const pendingByIdentity = new WeakMap<object, PendingAccountingMutation<unknown>>()
const pendingResolutionByCanonicalPayload = new Map<
  string,
  Promise<PendingAccountingMutation<unknown>>
>()
const pendingStatusByOperationId = new Map<
  string,
  Promise<AccountingMutationStatus | null>
>()

export async function executeAccountingMutation<TPayload, TResult>({
  identity,
  kind,
  operation,
  payload,
  request,
}: ExecuteAccountingMutationOptions<TPayload, TResult>): Promise<TResult> {
  const candidateSnapshot = snapshotImmutableAccountingPayload(payload)
  const mutationScope = createAccountingMutationScope(
    kind,
    getAccountingUserScope(),
  )
  const canonicalPayload = createCanonicalPayload(
    mutationScope,
    candidateSnapshot,
  )
  const pending = await resolvePendingMutation(
    kind,
    mutationScope,
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

  if (pending) {
    clearPendingMutation(pending)
    return true
  }

  return removePersistedAccountingMutation(normalized)
}

export async function getAccountingMutationStatus(
  operationId: string,
): Promise<AccountingMutationStatus | null> {
  const normalizedOperationId =
    normalizeAccountingOperationId(operationId)

  try {
    return await apiRequest<AccountingMutationStatus>(
      '/payments/mutations/status',
      {
        dedupe: false,
        query: {
          operationNetUid: normalizedOperationId,
        },
      },
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }

    throw error
  }
}

export function snapshotImmutableAccountingPayload<T>(payload: T): T {
  const serialized = JSON.stringify(payload)

  if (typeof serialized !== 'string') {
    throw new Error('Accounting mutation payload must be JSON serializable')
  }

  return deepFreeze(JSON.parse(serialized) as T)
}

/** A failure is definitive only when the server explicitly proves that the
 * request did not enter the mutation ledger. Network failures, aborts,
 * unmarked 4xx responses, and all 5xx responses keep the operation key and
 * immutable payload snapshot pending for a safe retry.
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
  mutationScope: string,
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
    mutationScope,
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
  mutationScope: string,
  payloadSnapshot: TPayload,
  canonicalPayload: string,
  identity: object | undefined,
  operationId: string | undefined,
): Promise<PendingAccountingMutation<TPayload>> {
  const [payloadSignature, mutationScopeSignature] = await Promise.all([
    hashCanonicalPayload(canonicalPayload),
    hashCanonicalPayload(mutationScope),
  ])
  const concurrentlyRegistered = findPendingMutation(
    kind,
    canonicalPayload,
    identity,
    operationId,
  )

  if (concurrentlyRegistered) {
    return concurrentlyRegistered as PendingAccountingMutation<TPayload>
  }

  const identityConflict = identity
    ? pendingByIdentity.get(identity)
    : undefined

  if (
    identityConflict &&
    identityConflict.mutationScope !== mutationScope
  ) {
    assertSameMutation(identityConflict, kind, canonicalPayload)
  }

  const unresolvedMutations = collectUnresolvedMutations(
    mutationScope,
    mutationScopeSignature,
  )
  const persistedOperationId = readPersistedOperationId(payloadSignature)
  const matchingUnresolved = unresolvedMutations.find(
    (candidate) => candidate.payloadSignature === payloadSignature,
  )
  const reusableOperationId =
    persistedOperationId ?? matchingUnresolved?.operationId

  if (
    operationId &&
    reusableOperationId &&
    operationId !== reusableOperationId
  ) {
    throw new Error(
      'The accounting payload is already pending under a different operation id',
    )
  }

  const reconciledOperationId = await reconcileChangedPayloadMutations(
    unresolvedMutations,
    payloadSignature,
    operationId,
    mutationScopeSignature,
  )

  const registeredAfterReconciliation = findPendingMutation(
    kind,
    canonicalPayload,
    identity,
    operationId,
  )

  if (registeredAfterReconciliation) {
    return registeredAfterReconciliation as PendingAccountingMutation<TPayload>
  }

  const pending = registerPendingMutation({
    canonicalPayload,
    identities: new Set(identity ? [identity] : []),
    kind,
    mutationScope,
    mutationScopeSignature,
    operationId:
      operationId ??
      reusableOperationId ??
      reconciledOperationId ??
      createAccountingMutationOperationId(),
    payloadSignature,
    payloadSnapshot,
  })

  return pending
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
    const reconciliationError =
      await reconcileAccountingMutationFingerprintConflict(
        pending,
        error,
      )

    if (reconciliationError) {
      throw reconciliationError
    }

    if (classifyAccountingMutationFailure(error) === 'definitive-failure') {
      clearPendingMutation(pending)
    }

    throw error
  }
}

async function reconcileAccountingMutationFingerprintConflict(
  pending: PendingAccountingMutation<unknown>,
  error: unknown,
): Promise<Error | null> {
  if (!isAccountingMutationFingerprintConflict(error)) {
    return null
  }

  let status: AccountingMutationStatus | null

  try {
    status = await readAccountingMutationStatus(pending.operationId)
  } catch {
    return null
  }

  if (status?.State === 'pending') {
    return new Error(
      'Попередня фінансова операція ще обробляється. Оновіть список і повторіть перевірку.',
    )
  }

  if (status?.State !== 'completed') {
    return null
  }

  clearPendingMutation(pending)
  return new Error(
    'Попередню фінансову операцію вже виконано. Оновіть список перед створенням нової.',
  )
}

function isAccountingMutationFingerprintConflict(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return false
  }

  const ledgerState = normalizeLedgerState(
    error.headers.get(ACCOUNTING_MUTATION_LEDGER_STATE_HEADER),
  )

  if (ledgerState === ACCOUNTING_MUTATION_LEDGER_FINGERPRINT_CONFLICT) {
    return true
  }

  return error.message.toLowerCase().includes(
    'idempotency key was already used for a different accounting mutation',
  )
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
  persistUnresolvedMutation(
    pending.mutationScopeSignature,
    pending.payloadSignature,
    pending.operationId,
  )

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
  removePersistedUnresolvedMutation(
    pending.mutationScopeSignature,
    pending.payloadSignature,
    pending.operationId,
  )
}

function collectUnresolvedMutations(
  mutationScope: string,
  mutationScopeSignature: string,
): PersistedUnresolvedAccountingMutation[] {
  // The lane journal survives object replacement and page reloads without
  // storing the financial payload or the mutation kind in clear text.
  const unresolvedByOperationId = new Map(
    readPersistedUnresolvedMutations(mutationScopeSignature)
      .map((pending) => [pending.operationId, pending]),
  )

  for (const pending of pendingByOperationId.values()) {
    if (pending.mutationScope === mutationScope) {
      unresolvedByOperationId.set(pending.operationId, {
        operationId: pending.operationId,
        payloadSignature: pending.payloadSignature,
      })
    }
  }

  return [...unresolvedByOperationId.values()]
}

async function reconcileChangedPayloadMutations(
  unresolvedMutations: PersistedUnresolvedAccountingMutation[],
  payloadSignature: string,
  requestedOperationId: string | undefined,
  mutationScopeSignature: string,
): Promise<string | undefined> {
  const conflictingMutation =
    unresolvedMutations.find(
      (unresolved) =>
        unresolved.payloadSignature !== payloadSignature &&
        requestedOperationId === unresolved.operationId,
    ) ??
    unresolvedMutations.find(
      (unresolved) => unresolved.payloadSignature !== payloadSignature,
    )

  if (!conflictingMutation) {
    return undefined
  }

  if (requestedOperationId === conflictingMutation.operationId) {
    throw new Error(
      'The accounting operation id is already pending with a different immutable payload',
    )
  }

  const status = await readAccountingMutationStatus(
    conflictingMutation.operationId,
  )

  if (status?.State === 'completed') {
    clearReconciledMutation(
      mutationScopeSignature,
      conflictingMutation,
    )
    throw new Error(
      'Попередню фінансову операцію вже виконано. Оновіть список перед створенням нової.',
    )
  }

  if (status?.State === 'pending') {
    throw new Error(
      'Попередня фінансова операція ще обробляється. Оновіть список і повторіть перевірку.',
    )
  }

  if (requestedOperationId) {
    throw new Error(
      'The previous accounting mutation outcome is unresolved; retry the exact immutable payload',
    )
  }

  clearReconciledMutation(
    mutationScopeSignature,
    conflictingMutation,
  )

  // Reusing the old UUID is safe even if the original request is still queued:
  // the server binds that UUID to one immutable request fingerprint.
  return conflictingMutation.operationId
}

function clearReconciledMutation(
  mutationScopeSignature: string,
  mutation: PersistedUnresolvedAccountingMutation,
) {
  const pending = pendingByOperationId.get(mutation.operationId)

  if (
    pending &&
    pending.payloadSignature === mutation.payloadSignature
  ) {
    clearPendingMutation(pending)
    return
  }

  removePersistedOperationIdentity(
    mutation.payloadSignature,
    mutation.operationId,
  )
  removePersistedUnresolvedMutation(
    mutationScopeSignature,
    mutation.payloadSignature,
    mutation.operationId,
  )
}

function removePersistedAccountingMutation(
  operationId: string,
): boolean {
  const journal = readPersistedMutationJournal()
  let changed = false

  for (const [signature, candidateOperationId] of Object.entries(journal)) {
    if (
      /^[0-9a-f]{64}$/.test(signature) &&
      candidateOperationId === operationId
    ) {
      delete journal[signature]
      changed = true
    }
  }

  const unresolvedScopes = readPersistedUnresolvedScopes(journal)

  for (const [scopeSignature, unresolved] of Object.entries(
    unresolvedScopes,
  )) {
    const remaining = readUnresolvedMutationList(unresolved)
      .filter((candidate) =>
        candidate.operationId !== operationId)

    if (remaining.length ===
        readUnresolvedMutationList(unresolved).length) {
      continue
    }

    changed = true
    if (remaining.length) {
      unresolvedScopes[scopeSignature] = remaining
    } else {
      delete unresolvedScopes[scopeSignature]
    }
  }

  if (Object.keys(unresolvedScopes).length) {
    journal[ACCOUNTING_MUTATION_UNRESOLVED_STORAGE_FIELD] =
      unresolvedScopes
  } else {
    delete journal[ACCOUNTING_MUTATION_UNRESOLVED_STORAGE_FIELD]
  }

  if (changed) {
    writePersistedMutationJournal(journal)
  }

  return changed
}

async function readAccountingMutationStatus(
  operationId: string,
): Promise<AccountingMutationStatus | null> {
  const existing = pendingStatusByOperationId.get(operationId)

  if (existing) {
    return existing
  }

  const status = getAccountingMutationStatus(operationId)
    .finally(() => {
      if (pendingStatusByOperationId.get(operationId) === status) {
        pendingStatusByOperationId.delete(operationId)
      }
    })
  pendingStatusByOperationId.set(operationId, status)

  return status
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
      if (
        byIdentity.kind !== kind ||
        byIdentity.canonicalPayload !== canonicalPayload
      ) {
        return undefined
      }

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

function createAccountingMutationScope(
  kind: string,
  userScope: string,
): string {
  const normalizedKind = kind.trim()

  if (!normalizedKind) {
    throw new Error('Accounting mutation kind is required')
  }

  return [
    `${userScope.length}:${userScope}`,
    `${normalizedKind.length}:${normalizedKind}`,
  ].join(':')
}

function createCanonicalPayload(
  mutationScope: string,
  payload: unknown,
): string {
  return [
    mutationScope,
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
  const journal = readPersistedMutationJournal()
  journal[payloadSignature] = operationId
  writePersistedMutationJournal(journal)
}

function removePersistedOperationIdentity(
  payloadSignature: string,
  operationId: string,
) {
  const journal = readPersistedMutationJournal()

  if (journal[payloadSignature] !== operationId) {
    return
  }

  delete journal[payloadSignature]
  writePersistedMutationJournal(journal)
}

function persistUnresolvedMutation(
  mutationScopeSignature: string,
  payloadSignature: string,
  operationId: string,
) {
  const journal = readPersistedMutationJournal()
  const unresolvedScopes = readPersistedUnresolvedScopes(journal)
  const unresolved = readUnresolvedMutationList(
    unresolvedScopes[mutationScopeSignature],
  )
  const existingIndex = unresolved.findIndex(
    (candidate) => candidate.operationId === operationId,
  )
  const candidate = {
    operationId,
    payloadSignature,
  }

  if (existingIndex >= 0) {
    unresolved[existingIndex] = candidate
  } else {
    unresolved.push(candidate)
  }

  unresolvedScopes[mutationScopeSignature] = unresolved
  journal[ACCOUNTING_MUTATION_UNRESOLVED_STORAGE_FIELD] =
    unresolvedScopes
  writePersistedMutationJournal(journal)
}

function removePersistedUnresolvedMutation(
  mutationScopeSignature: string,
  payloadSignature: string,
  operationId: string,
) {
  const journal = readPersistedMutationJournal()
  const unresolvedScopes = readPersistedUnresolvedScopes(journal)
  const remaining = readUnresolvedMutationList(
    unresolvedScopes[mutationScopeSignature],
  ).filter(
    (candidate) =>
      candidate.operationId !== operationId ||
      candidate.payloadSignature !== payloadSignature,
  )

  if (remaining.length > 0) {
    unresolvedScopes[mutationScopeSignature] = remaining
  } else {
    delete unresolvedScopes[mutationScopeSignature]
  }

  if (Object.keys(unresolvedScopes).length > 0) {
    journal[ACCOUNTING_MUTATION_UNRESOLVED_STORAGE_FIELD] =
      unresolvedScopes
  } else {
    delete journal[ACCOUNTING_MUTATION_UNRESOLVED_STORAGE_FIELD]
  }

  writePersistedMutationJournal(journal)
}

function readPersistedUnresolvedMutations(
  mutationScopeSignature: string,
): PersistedUnresolvedAccountingMutation[] {
  const journal = readPersistedMutationJournal()
  const unresolvedScopes = readPersistedUnresolvedScopes(journal)

  return readUnresolvedMutationList(
    unresolvedScopes[mutationScopeSignature],
  )
}

function readPersistedUnresolvedScopes(
  journal: Record<string, unknown>,
): Record<string, unknown> {
  const unresolved =
    journal[ACCOUNTING_MUTATION_UNRESOLVED_STORAGE_FIELD]

  if (!unresolved || typeof unresolved !== 'object' || Array.isArray(unresolved)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(unresolved).filter(
      ([signature]) => /^[0-9a-f]{64}$/.test(signature),
    ),
  )
}

function readUnresolvedMutationList(
  value: unknown,
): PersistedUnresolvedAccountingMutation[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((candidate) => {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    ) {
      return []
    }

    const {
      operationId,
      payloadSignature,
    } = candidate as Partial<PersistedUnresolvedAccountingMutation>

    if (
      typeof operationId !== 'string' ||
      typeof payloadSignature !== 'string' ||
      !/^[0-9a-f]{64}$/.test(payloadSignature)
    ) {
      return []
    }

    try {
      return [{
        operationId: normalizeAccountingOperationId(operationId),
        payloadSignature,
      }]
    } catch {
      return []
    }
  })
}

function readPersistedOperationIdentities(): Record<string, string> {
  const journal = readPersistedMutationJournal()

  return Object.fromEntries(
    Object.entries(journal).filter(
      ([signature, operationId]) =>
        /^[0-9a-f]{64}$/.test(signature) &&
        typeof operationId === 'string',
    ),
  ) as Record<string, string>
}

function readPersistedMutationJournal(): Record<string, unknown> {
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

    return value as Record<string, unknown>
  } catch {
    return {}
  }
}

function writePersistedMutationJournal(journal: Record<string, unknown>) {
  const storage = getSessionStorage()

  if (!storage) {
    return
  }

  try {
    if (Object.keys(journal).length === 0) {
      storage.removeItem(ACCOUNTING_MUTATION_STORAGE_KEY)
    } else {
      storage.setItem(
        ACCOUNTING_MUTATION_STORAGE_KEY,
        JSON.stringify(journal),
      )
    }
  } catch {
    // Storage is an availability aid. The in-memory registry remains fail-closed.
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
