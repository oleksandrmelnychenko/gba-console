import { ApiError } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
import { sanitizeConsumableOrderPayload } from '../consumableOrderPayload'
import type { ConsumablesOrder } from '../types'

export const CONSUMABLE_ORDER_IDEMPOTENCY_HEADER = 'Idempotency-Key'
export const CONSUMABLE_ORDER_LEDGER_STATE_HEADER = 'X-Consumables-Mutation-Ledger-State'
export const CONSUMABLE_ORDER_OWNER_HEADER = 'X-Consumables-Mutation-Owner'
export const CONSUMABLE_ORDER_LEDGER_NOT_ENTERED = 'not-entered'
export const CONSUMABLE_ORDER_LEDGER_ROLLED_BACK = 'rolled-back'

export type ConsumableOrderMutationOperationOptions = {
  identity?: object
  operationId?: string
  signal?: AbortSignal
}

type ConsumableOrderMutationKind = 'add' | 'update'

type ConsumableOrderMutationRequestContext = {
  body: FormData
  headers: HeadersInit
  operationId: string
  signal?: AbortSignal
}

type ExecuteConsumableOrderMutationOptions<TResult> = {
  documents: readonly File[]
  kind: ConsumableOrderMutationKind
  operation?: ConsumableOrderMutationOperationOptions
  order: ConsumablesOrder
  request: (context: ConsumableOrderMutationRequestContext) => Promise<TResult>
}

type PendingConsumableOrderMutation = {
  documents: readonly File[]
  identities: Set<object>
  immutableJsonPayload: string
  inFlight?: Promise<unknown>
  kind: ConsumableOrderMutationKind
  operationId: string
  ownerNetUid: string
  signature: string
}

type PendingMutationResolution = {
  pending: PendingConsumableOrderMutation
  recoversPreviousSnapshot: boolean
}

const STORAGE_KEY = 'gba:consumable-order-mutations:v1'
const MAXIMUM_FILE_COUNT = 20
const MAXIMUM_FILE_SIZE_BYTES = 25 * 1024 * 1024
const MAXIMUM_BATCH_SIZE_BYTES = 100 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set([
  'csv',
  'doc',
  'docx',
  'jpeg',
  'jpg',
  'pdf',
  'png',
  'txt',
  'xls',
  'xlsx',
])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const pendingBySignature = new Map<string, PendingConsumableOrderMutation>()
const pendingByOperationId = new Map<string, PendingConsumableOrderMutation>()
const pendingByIdentity = new WeakMap<object, PendingConsumableOrderMutation>()

export class ConsumableOrderPendingMutationRecoveredError extends Error {
  constructor() {
    super('The previous consumables-order save was recovered. Review the current form and save it again if further changes are required.')
    this.name = 'ConsumableOrderPendingMutationRecoveredError'
  }
}

export async function executeConsumableOrderMutation<TResult>({
  documents,
  kind,
  operation,
  order,
  request,
}: ExecuteConsumableOrderMutationOptions<TResult>): Promise<TResult> {
  const snapshot = await createMutationSnapshot(order, documents, kind)
  const resolution = resolvePendingMutation(
    snapshot,
    operation?.identity,
    operation?.operationId,
  )
  const { pending } = resolution

  if (pending.inFlight) {
    const result = await pending.inFlight as TResult
    if (resolution.recoversPreviousSnapshot) {
      throw new ConsumableOrderPendingMutationRecoveredError()
    }
    return result
  }

  const execution = requestPendingMutation(
    pending,
    operation?.signal,
    request,
  )
  pending.inFlight = execution

  try {
    const result = await execution
    if (resolution.recoversPreviousSnapshot) {
      throw new ConsumableOrderPendingMutationRecoveredError()
    }
    return result
  } finally {
    if (pending.inFlight === execution) {
      pending.inFlight = undefined
    }
  }
}

export function clearPendingConsumableOrderMutation(operationId: string): boolean {
  const normalizedOperationId = normalizeOperationId(operationId)
  const pending = pendingByOperationId.get(normalizedOperationId)

  if (!pending) {
    return false
  }

  clearPendingMutation(pending)
  return true
}

export function classifyConsumableOrderMutationFailure(error: unknown): 'definitive-failure' | 'unknown-outcome' {
  if (!(error instanceof ApiError)) {
    return 'unknown-outcome'
  }

  const ledgerState = error.headers
    .get(CONSUMABLE_ORDER_LEDGER_STATE_HEADER)
    ?.trim()
    .toLowerCase()

  return ledgerState === CONSUMABLE_ORDER_LEDGER_NOT_ENTERED
    || ledgerState === CONSUMABLE_ORDER_LEDGER_ROLLED_BACK
    ? 'definitive-failure'
    : 'unknown-outcome'
}

async function createMutationSnapshot(
  order: ConsumablesOrder,
  documents: readonly File[],
  kind: ConsumableOrderMutationKind,
): Promise<Omit<PendingConsumableOrderMutation, 'identities' | 'operationId'>> {
  validateDocuments(documents)

  const immutableJsonPayload = stableStringify(sanitizeConsumableOrderPayload(order))
  const ownerNetUid = getAuthenticatedUserNetUid()
  const documentSnapshots = Object.freeze([...documents])
  const documentIdentities = await Promise.all(
    documentSnapshots.map(async (document) => ({
      contentType: document.type,
      digest: await digestFile(document),
      length: document.size,
      name: document.name,
    })),
  )
  const canonicalFingerprint = stableStringify({
    documents: documentIdentities,
    kind,
    payload: immutableJsonPayload,
    user: ownerNetUid,
  })

  return {
    documents: documentSnapshots,
    immutableJsonPayload,
    kind,
    ownerNetUid,
    signature: await digestText(canonicalFingerprint),
  }
}

function resolvePendingMutation(
  snapshot: Omit<PendingConsumableOrderMutation, 'identities' | 'operationId'>,
  identity: object | undefined,
  requestedOperationId: string | undefined,
): PendingMutationResolution {
  const operationId = requestedOperationId
    ? normalizeOperationId(requestedOperationId)
    : undefined
  const byIdentity = identity ? pendingByIdentity.get(identity) : undefined
  const byOperationId = operationId
    ? pendingByOperationId.get(operationId)
    : undefined
  const bySignature = pendingBySignature.get(snapshot.signature)
  const existing = byOperationId ?? byIdentity ?? bySignature

  if (existing) {
    if (byIdentity === existing
      && !operationId
      && existing.kind === snapshot.kind
      && existing.signature !== snapshot.signature) {
      return {
        pending: existing,
        recoversPreviousSnapshot: true,
      }
    }
    assertSameSnapshot(existing, snapshot, operationId)
    claimIdentity(existing, identity)
    return {
      pending: existing,
      recoversPreviousSnapshot: false,
    }
  }

  const persisted = readPersistedOperations()
  const persistedOperationId = persisted[snapshot.signature]

  if (operationId) {
    const conflictingSignature = Object.entries(persisted)
      .find(([signature, persistedId]) =>
        signature !== snapshot.signature
        && persistedId === operationId)
    if (conflictingSignature) {
      throw new Error('The consumables-order operation id is pending with a different immutable payload or owner')
    }
    if (persistedOperationId && persistedOperationId !== operationId) {
      throw new Error('The consumables-order payload is pending under a different operation id')
    }
  }

  const pending: PendingConsumableOrderMutation = {
    ...snapshot,
    identities: new Set(identity ? [identity] : []),
    operationId: operationId
      ?? normalizeOperationId(persistedOperationId || createOperationId()),
  }

  pendingBySignature.set(pending.signature, pending)
  pendingByOperationId.set(pending.operationId, pending)
  claimIdentity(pending, identity)
  persistOperation(pending.signature, pending.operationId)
  return {
    pending,
    recoversPreviousSnapshot: false,
  }
}

async function requestPendingMutation<TResult>(
  pending: PendingConsumableOrderMutation,
  signal: AbortSignal | undefined,
  request: (context: ConsumableOrderMutationRequestContext) => Promise<TResult>,
): Promise<TResult> {
  if (getAuthenticatedUserNetUid() !== pending.ownerNetUid) {
    throw new Error(
      'Authenticated consumables-order owner changed before the request was sent.',
    )
  }

  const body = new FormData()
  body.append('order', pending.immutableJsonPayload)
  pending.documents.forEach((document) => body.append('documents', document))

  try {
    const result = await request({
      body,
      headers: {
        [CONSUMABLE_ORDER_IDEMPOTENCY_HEADER]: pending.operationId,
        [CONSUMABLE_ORDER_OWNER_HEADER]: pending.ownerNetUid,
      },
      operationId: pending.operationId,
      ...(signal ? { signal } : {}),
    })
    clearPendingMutation(pending)
    return result
  } catch (error) {
    if (classifyConsumableOrderMutationFailure(error) === 'definitive-failure') {
      clearPendingMutation(pending)
    }
    throw error
  }
}

function assertSameSnapshot(
  pending: PendingConsumableOrderMutation,
  snapshot: Omit<PendingConsumableOrderMutation, 'identities' | 'operationId'>,
  requestedOperationId: string | undefined,
) {
  if (pending.kind !== snapshot.kind || pending.signature !== snapshot.signature) {
    if (requestedOperationId === pending.operationId) {
      throw new Error('The consumables-order operation id is pending with a different immutable payload or owner')
    }
    throw new Error('The pending consumables-order operation must be retried with the same payload and files')
  }
  if (requestedOperationId && requestedOperationId !== pending.operationId) {
    throw new Error('The consumables-order payload is pending under a different operation id')
  }
}

function claimIdentity(
  pending: PendingConsumableOrderMutation,
  identity: object | undefined,
) {
  if (!identity) {
    return
  }

  pending.identities.add(identity)
  pendingByIdentity.set(identity, pending)
}

function clearPendingMutation(pending: PendingConsumableOrderMutation) {
  if (pendingBySignature.get(pending.signature) === pending) {
    pendingBySignature.delete(pending.signature)
  }
  if (pendingByOperationId.get(pending.operationId) === pending) {
    pendingByOperationId.delete(pending.operationId)
  }
  pending.identities.forEach((identity) => {
    if (pendingByIdentity.get(identity) === pending) {
      pendingByIdentity.delete(identity)
    }
  })
  pending.identities.clear()
  removePersistedOperation(pending.signature, pending.operationId)
}

function validateDocuments(documents: readonly File[]) {
  if (documents.length > MAXIMUM_FILE_COUNT) {
    throw new Error(`A consumables order supports at most ${MAXIMUM_FILE_COUNT} documents`)
  }

  const names = new Set<string>()
  let batchSize = 0

  documents.forEach((document) => {
    const normalizedName = document.name.trim()
    const extension = normalizedName.split('.').pop()?.toLowerCase() || ''

    if (!normalizedName
      || normalizedName.length > 255
      || normalizedName.includes('/')
      || normalizedName.includes('\\')) {
      throw new Error('A consumables-order document filename is invalid')
    }
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error('The consumables-order document extension is not allowed')
    }
    if (document.size <= 0 || document.size > MAXIMUM_FILE_SIZE_BYTES) {
      throw new Error('Every consumables-order document must contain no more than 25 MB')
    }
    const normalizedKey = normalizedName.toLowerCase()
    if (names.has(normalizedKey)) {
      throw new Error('Consumables-order document filenames must be unique')
    }
    names.add(normalizedKey)

    batchSize += document.size
    if (batchSize > MAXIMUM_BATCH_SIZE_BYTES) {
      throw new Error('The consumables-order document batch is too large')
    }
  })
}

async function digestFile(file: File): Promise<string> {
  return digestBytes(await file.arrayBuffer())
}

async function digestText(value: string): Promise<string> {
  return digestBytes(new TextEncoder().encode(value).buffer)
}

async function digestBytes(value: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure consumables-order payload hashing is unavailable')
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', value)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')).join('')
}

function createOperationId(): string {
  const operationId = globalThis.crypto?.randomUUID?.()

  if (!operationId) {
    throw new Error('Secure UUID generation is unavailable')
  }

  return normalizeOperationId(operationId)
}

function normalizeOperationId(operationId: string): string {
  const normalized = operationId.trim().toLowerCase()

  if (!UUID_PATTERN.test(normalized)
    || normalized === '00000000-0000-0000-0000-000000000000') {
    throw new Error('OperationNetUid must be a non-empty UUID')
  }

  return normalized
}

function getAuthenticatedUserNetUid(): string {
  try {
    const session = readSession()
    const userNetUid = session?.userNetUid?.trim().toLowerCase()
      || session?.user?.NetUid?.trim().toLowerCase()

    if (userNetUid
      && UUID_PATTERN.test(userNetUid)
      && userNetUid !== '00000000-0000-0000-0000-000000000000') {
      return userNetUid
    }
  } catch {
    // A mutation cannot be safely owner-bound without the authenticated NetUid.
  }

  throw new Error('Authenticated consumables-order owner identity is unavailable.')
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
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    return `{${properties.join(',')}}`
  }

  const serialized = JSON.stringify(value)
  if (typeof serialized !== 'string') {
    throw new Error('Consumables-order payload contains an unsupported value')
  }
  return serialized
}

function readPersistedOperations(): Record<string, string> {
  const storage = getSessionStorage()

  if (!storage) {
    return {}
  }

  try {
    const serialized = storage.getItem(STORAGE_KEY)
    if (!serialized) {
      return {}
    }

    const parsed = JSON.parse(serialized) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([signature, operationId]) =>
        /^[0-9a-f]{64}$/.test(signature)
        && typeof operationId === 'string'
        && UUID_PATTERN.test(operationId)),
    )
  } catch {
    return {}
  }
}

function persistOperation(signature: string, operationId: string) {
  const storage = getSessionStorage()

  if (!storage) {
    return
  }

  try {
    const operations = readPersistedOperations()
    operations[signature] = operationId
    storage.setItem(STORAGE_KEY, JSON.stringify(operations))
  } catch {
    // Browser storage improves retry durability; the in-memory registry remains authoritative.
  }
}

function removePersistedOperation(signature: string, operationId: string) {
  const storage = getSessionStorage()

  if (!storage) {
    return
  }

  try {
    const operations = readPersistedOperations()
    if (operations[signature] !== operationId) {
      return
    }

    delete operations[signature]
    if (Object.keys(operations).length === 0) {
      storage.removeItem(STORAGE_KEY)
    } else {
      storage.setItem(STORAGE_KEY, JSON.stringify(operations))
    }
  } catch {
    // A failed cleanup does not change the outcome of the completed request.
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
