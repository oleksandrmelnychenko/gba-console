import type { AuthSession } from '../../shared/auth/types'
import { normalizeSalesOperationNetUid } from './salesMutationOperation'

const ENTRY_STORAGE_PREFIX = 'gba_console:sales-pending-mutation:v3:'
const LEGACY_ENTRY_STORAGE_PREFIX = 'gba_console:sales-pending-mutation:v2:'
const LEGACY_SESSION_STORAGE_KEY = 'gba_console:sales-pending-mutations:v1'
const CONTROL_STORAGE_PREFIX = 'gba_console:sales-mutation-control:v1:'
const TOMBSTONE_STORAGE_PREFIX = 'gba_console:sales-mutation-tombstone:v1:'
const CORRUPTION_STORAGE_PREFIX = 'gba_console:sales-mutation-corruption:v1:'
const CLAIM_STORAGE_PREFIX = 'gba_console:sales-mutation-claim:v1:'
const TAB_OWNER_SESSION_KEY = 'gba_console:sales-pending-owner:v1'
const REGISTRY_VERSION = 3
const CONTROL_VERSION = 1
const FALLBACK_ARBITRATION_MS = 32
const FALLBACK_CLAIM_TTL_MS = 5_000
const TAB_OWNER_RUNTIME_ID = createRandomId('runtime')
export const SALES_MUTATION_LEASE_MS = 15_000
export const SALES_MUTATION_RESOLUTION_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000

export const SALES_PENDING_MUTATION_KINDS = [
  'cart',
  'create-sale',
  'merged-sale',
  'sale-discount',
  'sale-comment',
  'sale-recipient',
  'sale-recipient-address',
  'sale-shift-current',
  'sale-switch',
  'sale-update',
  'sale-update-file',
  'sale-vat-document',
] as const

export type SalesPendingMutationKind = (typeof SALES_PENDING_MUTATION_KINDS)[number]
export type SalesPendingMutationPhase = 'prepared' | 'submitted' | 'unknown'

export type SalesPendingMutationScope = {
  context: string
  kind: SalesPendingMutationKind
  userKey: string
}

export type SalesPendingMutationEntry<TPayload = unknown> = SalesPendingMutationScope & {
  createdAt: number
  expiresAt: null
  fencingToken: string
  generation: number
  operationId: string
  ownerId: string
  ownerUpdatedAt: number
  payload: TPayload
  phase: SalesPendingMutationPhase
  resumable: boolean
  version: typeof REGISTRY_VERSION
}

export type SalesPendingMutationFence = SalesPendingMutationScope & {
  fencingToken: string
  generation: number
  operationId: string
  ownerId: string
}

export type SalesPendingMutationLease<TPayload = unknown> = SalesPendingMutationFence & {
  entry: SalesPendingMutationEntry<TPayload>
}

export type SalesMutationGarbageCollectionResult = {
  controlsRemoved: number
  tombstonesRemoved: number
}

type SalesMutationControl = SalesPendingMutationFence & {
  leaseUntil: number
  ownerUpdatedAt: number
  phase: SalesPendingMutationPhase | 'resolved'
  resolution?: SalesMutationResolution
  resolvedAt?: number
  state: 'active' | 'resolved'
  version: typeof CONTROL_VERSION
}

type SalesMutationResolution = 'committed' | 'manual-committed' | 'not-submitted'

type SalesMutationControlObservation = Pick<
  SalesMutationControl,
  'fencingToken' | 'generation' | 'operationId' | 'state'
> | null

type SalesMutationTombstone = SalesPendingMutationFence & {
  resolution: SalesMutationResolution
  resolvedAt: number
  version: typeof CONTROL_VERSION
}

type SalesMutationCorruption = {
  detectedAt: number
  operationId: string | null
  reason: string
  scope: SalesPendingMutationScope | null
  sourceKey: string
  version: typeof CONTROL_VERSION
}

type SalesMutationClaim = SalesPendingMutationScope & {
  claimId: string
  createdAt: number
  expiresAt: number
  operationId: string
  ownerId: string
  version: typeof CONTROL_VERSION
}

export class SalesPendingMutationStorageError extends Error {
  constructor(message = 'Браузер не дозволив надійно прочитати або зберегти операцію. Запит не надіслано; перевірте сховище браузера й повторіть звірку.') {
    super(message)
    this.name = 'SalesPendingMutationStorageError'
  }
}

export class SalesPendingMutationCorruptionError extends Error {
  constructor(message = 'Журнал операції пошкоджений. Автоматичне очищення і нові запити заблоковано до ручної звірки.') {
    super(message)
    this.name = 'SalesPendingMutationCorruptionError'
  }
}

export class SalesPendingMutationConflictError extends Error {
  constructor(message = 'Є інша непідтверджена операція для цієї дії. Спочатку звірте її результат.') {
    super(message)
    this.name = 'SalesPendingMutationConflictError'
  }
}

export class SalesPendingMutationFenceError extends Error {
  constructor(message = 'Координація операції перейшла до іншої вкладки. Застаріла вкладка не може надсилати або очищати запит.') {
    super(message)
    this.name = 'SalesPendingMutationFenceError'
  }
}

type PendingMutationListener = (event: { external: boolean; key: string | null }) => void
const pendingMutationListeners = new Set<PendingMutationListener>()
let storageListenerInstalled = false

export function getSalesPendingMutationUserKey(session: AuthSession | null | undefined): string {
  const netUid = normalizeIdentity(session?.userNetUid || session?.user?.NetUid)

  if (netUid) {
    return `net:${netUid}`
  }

  return typeof session?.user?.Id === 'number' && session.user.Id > 0 ? `id:${session.user.Id}` : ''
}

/**
 * Persists a frozen request before lock acquisition. This entry never authorizes
 * network I/O; every sender must still acquire a fenced lease below.
 */
export function saveSalesPendingMutation<TPayload>(
  scope: SalesPendingMutationScope,
  operationId: string,
  payload: TPayload,
  options: { now?: number; resumable?: boolean; ttlMs?: number } = {},
): SalesPendingMutationEntry<TPayload> {
  const normalizedScope = normalizeScope(scope)
  const normalizedOperationId = normalizeSalesOperationNetUid(operationId)
  const existing = loadSalesPendingMutationByOperation<TPayload>(normalizedScope, normalizedOperationId)

  if (existing) {
    assertSameFrozenPayload(existing.payload, payload)
    return existing
  }

  const conflicting = readEntriesForScope(normalizedScope).find((entry) => entry.operationId !== normalizedOperationId)

  if (conflicting) {
    throw new SalesPendingMutationConflictError()
  }

  assertNoCorruption(normalizedScope, normalizedOperationId)
  assertOperationNotTombstoned(normalizedScope, normalizedOperationId)
  const now = options.now ?? Date.now()
  const ownerId = getSalesMutationTabOwnerId()
  const entry: SalesPendingMutationEntry<TPayload> = freezeEntry({
    ...normalizedScope,
    createdAt: now,
    expiresAt: null,
    fencingToken: `unclaimed:${normalizedOperationId}`,
    generation: 0,
    operationId: normalizedOperationId,
    ownerId,
    ownerUpdatedAt: now,
    payload: cloneJson(payload),
    phase: 'prepared',
    resumable: options.resumable !== false,
    version: REGISTRY_VERSION,
  })
  writeEntry(entry, true)

  return entry
}

export function loadSalesPendingMutation<TPayload>(
  scope: SalesPendingMutationScope,
  now: number = Date.now(),
): SalesPendingMutationEntry<TPayload> | null {
  void now
  const normalizedScope = normalizeScope(scope)
  assertNoCorruption(normalizedScope)
  const entries = readEntriesForScope(normalizedScope)

  if (entries.length > 1) {
    markSalesPendingMutationCorrupt(normalizedScope, null, 'Кілька unresolved operationId в одному mutation scope')
  }

  const entry = entries[0]
  return entry ? freezeEntry(cloneJson(entry)) as SalesPendingMutationEntry<TPayload> : null
}

export function loadSalesPendingMutationByOperation<TPayload>(
  scope: SalesPendingMutationScope,
  operationId: string,
): SalesPendingMutationEntry<TPayload> | null {
  const normalizedScope = normalizeScope(scope)
  const normalizedOperationId = normalizeSalesOperationNetUid(operationId)
  assertNoCorruption(normalizedScope, normalizedOperationId)

  if (readTombstone(normalizedScope, normalizedOperationId)) {
    return null
  }

  const entry = readEntriesForScope(normalizedScope)
    .find((candidate) => candidate.operationId === normalizedOperationId)

  return entry ? freezeEntry(cloneJson(entry)) as SalesPendingMutationEntry<TPayload> : null
}

export function listSalesPendingMutationsForUser(
  userKey: string,
  now: number = Date.now(),
): ReadonlyArray<SalesPendingMutationEntry> {
  void now
  const normalizedUserKey = normalizeIdentity(userKey)

  if (!normalizedUserKey) {
    return Object.freeze([])
  }

  assertNoCorruptionForUser(normalizedUserKey)
  return deepFreeze(readAllEntries()
    .filter((entry) => entry.userKey === normalizedUserKey)
    .map((entry) => cloneJson(entry)))
}

/** Only unclaimed prepared evidence may be removed without a fence. */
export function clearSalesPendingMutation(
  scope: SalesPendingMutationScope,
  operationId?: string,
  now: number = Date.now(),
): void {
  const normalizedScope = normalizeScope(scope)
  const normalizedOperationId = operationId ? normalizeSalesOperationNetUid(operationId) : null
  assertNoCorruption(normalizedScope, normalizedOperationId)
  const entries = readEntriesForScope(normalizedScope)
    .filter((entry) => !normalizedOperationId || entry.operationId === normalizedOperationId)

  for (const entry of entries) {
    if (entry.generation > 0 || entry.phase !== 'prepared') {
      throw new SalesPendingMutationFenceError('Надісланий або claimed журнал можна закрити лише matching fencing token.')
    }

    writeTombstone({
      ...toFence(entry),
      resolution: 'not-submitted',
      resolvedAt: now,
      version: CONTROL_VERSION,
    })
    removeEntry(entry)
  }

  clearLegacyEntries(normalizedScope, normalizedOperationId)
}

export async function withSalesPendingMutationLock<TPayload, TResult>(
  scope: SalesPendingMutationScope,
  operationId: string,
  payload: TPayload,
  callback: (lease: SalesPendingMutationLease<TPayload>) => Promise<TResult>,
  options: { now?: () => number; resumable?: boolean } = {},
): Promise<TResult> {
  const normalizedScope = normalizeScope(scope)
  const normalizedOperationId = normalizeSalesOperationNetUid(operationId)
  const lockName = `gba-sales-mutation:${encodeScope(normalizedScope)}`
  const lockManager = getWebLocksManager()
  const observedControl = observeSalesMutationControl(normalizedScope)
  const observedConflict = readEntriesForScope(normalizedScope)
    .find((entry) => entry.operationId !== normalizedOperationId)

  if (observedConflict) {
    throw new SalesPendingMutationConflictError()
  }

  const run = async () => {
    const lease = lockManager
      ? acquireDurableLease(normalizedScope, normalizedOperationId, payload, options, true, observedControl)
      : await acquireFallbackLease(normalizedScope, normalizedOperationId, payload, options, observedControl)
    const stopHeartbeat = startLeaseHeartbeat(lease, options.now)

    try {
      assertSalesPendingMutationFence(lease)
      return await callback(lease)
    } finally {
      stopHeartbeat()
    }
  }

  return lockManager
    ? lockManager.request(lockName, { mode: 'exclusive' }, run)
    : run()
}

export function markSalesPendingMutationSubmitted(lease: SalesPendingMutationFence): void {
  updateFencedMutationPhase(lease, 'submitted')
}

export function markSalesPendingMutationUnknown(lease: SalesPendingMutationFence): void {
  updateFencedMutationPhase(lease, 'unknown')
}

export function resolveSalesPendingMutation(
  lease: SalesPendingMutationFence,
  resolution: Exclude<SalesMutationResolution, 'not-submitted'>,
  now: number = Date.now(),
): void {
  settleSalesPendingMutation(lease, resolution, now)
}

/** Use only when a definitive server rejection proves the operation never entered its ledger. */
export function resolveRejectedSalesPendingMutation(
  lease: SalesPendingMutationFence,
  now: number = Date.now(),
): void {
  settleSalesPendingMutation(lease, 'not-submitted', now)
}

function settleSalesPendingMutation(
  lease: SalesPendingMutationFence,
  resolution: SalesMutationResolution,
  now: number,
): void {
  const { control, entry } = assertSalesPendingMutationFence(lease)
  const tombstone: SalesMutationTombstone = {
    ...toFence(control),
    resolution,
    resolvedAt: now,
    version: CONTROL_VERSION,
  }
  writeTombstone(tombstone)
  writeControl({
    ...control,
    leaseUntil: now,
    ownerUpdatedAt: now,
    phase: 'resolved',
    resolution,
    resolvedAt: now,
    state: 'resolved',
  })
  removeEntry(entry)
}

export function releasePreparedSalesPendingMutation(
  lease: SalesPendingMutationFence,
  now: number = Date.now(),
): void {
  const { control, entry } = assertSalesPendingMutationFence(lease)

  if (entry.phase !== 'prepared' || control.phase !== 'prepared') {
    throw new SalesPendingMutationFenceError('Після submitted операцію не можна звільнити або трактувати як невиконану без server ledger proof.')
  }

  writeTombstone({
    ...toFence(control),
    resolution: 'not-submitted',
    resolvedAt: now,
    version: CONTROL_VERSION,
  })
  writeControl({
    ...control,
    leaseUntil: now,
    ownerUpdatedAt: now,
    phase: 'resolved',
    resolution: 'not-submitted',
    resolvedAt: now,
    state: 'resolved',
  })
  removeEntry(entry)
}

export function assertSalesPendingMutationFence(
  lease: SalesPendingMutationFence,
): { control: SalesMutationControl; entry: SalesPendingMutationEntry } {
  const scope = normalizeScope(lease)
  const operationId = normalizeSalesOperationNetUid(lease.operationId)
  assertNoCorruption(scope, operationId)
  const control = readControl(scope)
  const entry = readEntryByOperation(scope, operationId)

  if (
    !control || control.state !== 'active' || !entry ||
    control.operationId !== operationId || entry.operationId !== operationId ||
    control.generation !== lease.generation || entry.generation !== lease.generation ||
    control.fencingToken !== lease.fencingToken || entry.fencingToken !== lease.fencingToken ||
    control.ownerId !== lease.ownerId || entry.ownerId !== lease.ownerId
  ) {
    throw new SalesPendingMutationFenceError()
  }

  return { control, entry }
}

export function markSalesPendingMutationCorrupt(
  scope: SalesPendingMutationScope,
  operationId: string | null,
  reason: string,
  sourceKey = 'consumer-schema',
): never {
  const normalizedScope = normalizeScope(scope)
  const normalizedOperationId = operationId ? normalizeSalesOperationNetUid(operationId) : null
  const corruption: SalesMutationCorruption = {
    detectedAt: Date.now(),
    operationId: normalizedOperationId,
    reason,
    scope: normalizedScope,
    sourceKey,
    version: CONTROL_VERSION,
  }
  writeCorruption(corruption)
  throw new SalesPendingMutationCorruptionError(reason)
}

export function subscribeSalesPendingMutations(listener: PendingMutationListener): () => void {
  pendingMutationListeners.add(listener)
  installStorageListener()

  return () => {
    pendingMutationListeners.delete(listener)

    if (pendingMutationListeners.size === 0) {
      uninstallStorageListener()
    }
  }
}

export function synchronizeSalesPendingMutationUser(userKey: string, now: number = Date.now()): void {
  const normalizedUserKey = normalizeIdentity(userKey)

  if (normalizedUserKey) {
    assertNoCorruptionForUser(normalizedUserKey)
  } else {
    readAllEntries()
  }

  collectSalesMutationGarbage(now)
}

export function collectSalesMutationGarbage(
  now: number = Date.now(),
  userKey = '',
): SalesMutationGarbageCollectionResult {
  if (!Number.isFinite(now)) {
    throw new Error('Sales mutation garbage collection requires a finite timestamp')
  }

  const storage = getStorageOrThrow()
  const normalizedUserKey = normalizeIdentity(userKey)
  const controls: Array<{ key: string; value: SalesMutationControl }> = []
  const tombstones: Array<{ key: string; value: SalesMutationTombstone }> = []
  const pendingEntries = listStoredSalesMutationEntryIdentities(storage)

  for (const key of listStorageKeysStrict(storage)) {
    if (!key.startsWith(CONTROL_STORAGE_PREFIX) && !key.startsWith(TOMBSTONE_STORAGE_PREFIX)) {
      continue
    }

    const raw = getStorageItemStrict(storage, key)

    if (raw === null) {
      continue
    }

    const parsed = parseJsonOrCorrupt(raw, key)

    if (key.startsWith(CONTROL_STORAGE_PREFIX)) {
      if (!isSalesMutationControl(parsed)) {
        persistCorruptionForRawKey(key, 'Invalid mutation control schema')
      }

      if (!normalizedUserKey || parsed.userKey === normalizedUserKey) {
        controls.push({ key, value: parsed })
      }

      continue
    }

    if (!isSalesMutationTombstone(parsed)) {
      persistCorruptionForRawKey(key, 'Invalid mutation tombstone schema')
    }

    if (!normalizedUserKey || parsed.userKey === normalizedUserKey) {
      tombstones.push({ key, value: parsed })
    }
  }

  let controlsRemoved = 0
  let tombstonesRemoved = 0

  // Remove controls first. If a later tombstone removal fails, the remaining
  // tombstone still permanently fences stale callbacks.
  for (const { key, value } of controls) {
    if (
      value.state !== 'resolved' ||
      value.phase !== 'resolved' ||
      !isExpiredResolution(value.resolvedAt, now) ||
      hasStoredSalesMutationEntry(pendingEntries, value)
    ) {
      continue
    }

    if (removeResolvedControlIfUnchanged(storage, key, value, now)) {
      controlsRemoved += 1
    }
  }

  for (const { key, value } of tombstones) {
    if (
      !isExpiredResolution(value.resolvedAt, now) ||
      hasStoredSalesMutationEntry(pendingEntries, value, value.operationId)
    ) {
      continue
    }

    removeStorageItemRequired(storage, key)
    tombstonesRemoved += 1
  }

  return { controlsRemoved, tombstonesRemoved }
}

function removeResolvedControlIfUnchanged(
  storage: Storage,
  key: string,
  candidate: SalesMutationControl,
  now: number,
): boolean {
  const raw = getStorageItemStrict(storage, key)

  if (raw === null) {
    return false
  }

  const current = parseJsonOrCorrupt(raw, key)

  if (!isSalesMutationControl(current)) {
    persistCorruptionForRawKey(key, 'Invalid mutation control schema')
  }

  if (
    current.state !== 'resolved' ||
    current.phase !== 'resolved' ||
    !isExpiredResolution(current.resolvedAt, now) ||
    !hasSameResolvedControlIdentity(current, candidate) ||
    hasStoredSalesMutationEntry(listStoredSalesMutationEntryIdentities(storage), current)
  ) {
    return false
  }

  // localStorage operations are synchronous: after this compare there is no
  // browser task interleaving before removeItem in this tab.
  removeStorageItemRequired(storage, key)
  return true
}

function hasSameResolvedControlIdentity(
  left: SalesMutationControl,
  right: SalesMutationControl,
): boolean {
  return matchesScope(left, right) &&
    left.operationId === right.operationId &&
    left.generation === right.generation &&
    left.fencingToken === right.fencingToken &&
    left.ownerId === right.ownerId &&
    left.resolution === right.resolution &&
    left.resolvedAt === right.resolvedAt
}

/** Test/logout-only reset. Normal business flows must resolve with a fence. */
export function clearAllSalesPendingMutations(): void {
  const storage = getStorageOrThrow()

  for (const key of listStorageKeysStrict(storage)) {
    if (isSalesMutationStorageKey(key)) {
      removeStorageItemRequired(storage, key)
    }
  }

  const legacy = getLegacyStorageOrThrow()
  removeStorageItemRequired(legacy, LEGACY_SESSION_STORAGE_KEY)
}

function acquireDurableLease<TPayload>(
  scope: SalesPendingMutationScope,
  operationId: string,
  payload: TPayload,
  options: { now?: () => number; resumable?: boolean },
  exclusiveBrowserLockHeld = false,
  observedControl: SalesMutationControlObservation = null,
): SalesPendingMutationLease<TPayload> {
  const now = options.now?.() ?? Date.now()
  const ownerId = getSalesMutationTabOwnerId()
  assertNoCorruption(scope, operationId)
  assertOperationNotTombstoned(scope, operationId)
  const control = readControl(scope)

  if (
    control?.operationId !== operationId &&
    !hasSameControlObservation(control, observedControl)
  ) {
    throw new SalesPendingMutationConflictError(
      'Mutation scope змінився, поки операція чекала координацію; queued запит не надіслано.',
    )
  }

  const scopedEntries = readEntriesForScope(scope)
  const conflicting = scopedEntries.find((entry) => entry.operationId !== operationId)

  if (conflicting) {
    throw new SalesPendingMutationConflictError()
  }

  if (control?.state === 'active') {
    if (control.operationId !== operationId) {
      throw new SalesPendingMutationConflictError()
    }

    if (
      control.ownerId !== ownerId &&
      control.leaseUntil > now &&
      !exclusiveBrowserLockHeld
    ) {
      throw new SalesPendingMutationConflictError('Операція зараз виконується в іншій вкладці.')
    }
  }

  const existing = scopedEntries.find((entry) => entry.operationId === operationId)

  if (existing) {
    assertSameFrozenPayload(existing.payload, payload)
  }

  const ownerChanged = Boolean(control && control.ownerId !== ownerId)
  const generation = Math.max(control?.generation ?? 0, existing?.generation ?? 0) + (ownerChanged || !control ? 1 : 0)
  const fencingToken = createFencingToken(generation)
  const phase = existing?.phase ?? (control?.state === 'active' ? control.phase as SalesPendingMutationPhase : 'prepared')
  const entry: SalesPendingMutationEntry<TPayload> = freezeEntry({
    ...scope,
    createdAt: existing?.createdAt ?? now,
    expiresAt: null,
    fencingToken,
    generation,
    operationId,
    ownerId,
    ownerUpdatedAt: now,
    payload: cloneJson(existing ? existing.payload as TPayload : payload),
    phase,
    resumable: existing?.resumable ?? options.resumable !== false,
    version: REGISTRY_VERSION,
  })
  const nextControl: SalesMutationControl = {
    ...toFence(entry),
    leaseUntil: now + SALES_MUTATION_LEASE_MS,
    ownerUpdatedAt: now,
    phase,
    state: 'active',
    version: CONTROL_VERSION,
  }
  writeControl(nextControl)
  writeEntry(entry, true)
  const lease: SalesPendingMutationLease<TPayload> = { ...toFence(entry), entry }
  assertSalesPendingMutationFence(lease)

  return lease
}

async function acquireFallbackLease<TPayload>(
  scope: SalesPendingMutationScope,
  operationId: string,
  payload: TPayload,
  options: { now?: () => number; resumable?: boolean },
  observedControl: SalesMutationControlObservation,
): Promise<SalesPendingMutationLease<TPayload>> {
  const now = options.now?.() ?? Date.now()
  const ownerId = getSalesMutationTabOwnerId()
  const existingControl = readControl(scope)

  if (
    existingControl?.state === 'active' &&
    existingControl.ownerId !== ownerId &&
    existingControl.leaseUntil > now
  ) {
    throw new SalesPendingMutationConflictError('Операція зараз виконується в іншій вкладці.')
  }

  const claim = createClaim(scope, operationId, ownerId, now)
  writeClaim(claim)

  try {
    await delay(FALLBACK_ARBITRATION_MS)
    const controlAfterWait = readControl(scope)
    const currentNow = options.now?.() ?? Date.now()

    if (
      controlAfterWait?.state === 'active' &&
      controlAfterWait.ownerId !== ownerId &&
      controlAfterWait.leaseUntil > currentNow
    ) {
      throw new SalesPendingMutationConflictError('Операція зараз виконується в іншій вкладці.')
    }

    const winner = readClaimsForScope(scope, currentNow)
      .sort((left, right) => left.claimId.localeCompare(right.claimId))[0]

    if (!winner || winner.claimId !== claim.claimId) {
      throw new SalesPendingMutationConflictError('Інша вкладка отримала mutation lease.')
    }

    return acquireDurableLease(scope, operationId, payload, options, false, observedControl)
  } finally {
    removeClaim(claim)
  }
}

function updateFencedMutationPhase(
  lease: SalesPendingMutationFence,
  phase: Extract<SalesPendingMutationPhase, 'submitted' | 'unknown'>,
): void {
  const { control, entry } = assertSalesPendingMutationFence(lease)
  const now = Date.now()
  const nextEntry = freezeEntry({ ...entry, ownerUpdatedAt: now, phase })
  writeControl({
    ...control,
    leaseUntil: now + SALES_MUTATION_LEASE_MS,
    ownerUpdatedAt: now,
    phase,
  })
  writeEntry(nextEntry, true)
  assertSalesPendingMutationFence(lease)
}

function startLeaseHeartbeat(
  lease: SalesPendingMutationFence,
  nowProvider?: () => number,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const timer = window.setInterval(() => {
    try {
      const { control, entry } = assertSalesPendingMutationFence(lease)
      const now = nowProvider?.() ?? Date.now()
      writeControl({ ...control, leaseUntil: now + SALES_MUTATION_LEASE_MS, ownerUpdatedAt: now })
      writeEntry(freezeEntry({ ...entry, ownerUpdatedAt: now }), true)
    } catch {
      window.clearInterval(timer)
    }
  }, Math.floor(SALES_MUTATION_LEASE_MS / 3))

  return () => window.clearInterval(timer)
}

function readAllEntries(): SalesPendingMutationEntry[] {
  const storage = getStorageOrThrow()
  const entries: SalesPendingMutationEntry[] = []

  for (const key of listStorageKeysStrict(storage)) {
    if (!key.startsWith(ENTRY_STORAGE_PREFIX) && !key.startsWith(LEGACY_ENTRY_STORAGE_PREFIX)) {
      continue
    }

    const raw = getStorageItemStrict(storage, key)

    if (raw === null) {
      continue
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(raw)
    } catch {
      persistCorruptionForRawKey(key, 'JSON parse error')
    }

    const normalized = normalizeStoredEntry(parsed)

    if (!normalized) {
      persistCorruptionForRawKey(key, 'Invalid pending mutation schema')
    }

    if (!readTombstone(normalized, normalized.operationId)) {
      entries.push(normalized)
    }
  }

  for (const entry of readLegacyRegistry()) {
    if (!entries.some((candidate) => getEntryStorageKey(candidate) === getEntryStorageKey(entry))) {
      entries.push(entry)
    }
  }

  return entries
}

function readEntriesForScope(scope: SalesPendingMutationScope): SalesPendingMutationEntry[] {
  return readAllEntries().filter((entry) => matchesScope(entry, scope))
}

function readEntryByOperation(
  scope: SalesPendingMutationScope,
  operationId: string,
): SalesPendingMutationEntry | null {
  return readEntriesForScope(scope).find((entry) => entry.operationId === operationId) ?? null
}

function listStoredSalesMutationEntryIdentities(
  storage: Storage,
): Array<{ operationId: string; scope: SalesPendingMutationScope }> {
  const identities: Array<{ operationId: string; scope: SalesPendingMutationScope }> = []

  for (const key of listStorageKeysStrict(storage)) {
    if (!key.startsWith(ENTRY_STORAGE_PREFIX) && !key.startsWith(LEGACY_ENTRY_STORAGE_PREFIX)) {
      continue
    }

    const identity = parseIdentityFromStorageKey(key)

    if (!identity) {
      persistCorruptionForRawKey(key, 'Invalid pending mutation storage key')
    }

    identities.push(identity)
  }

  for (const entry of readLegacyRegistry()) {
    if (!identities.some((identity) => (
      identity.operationId === entry.operationId && matchesScope(identity.scope, entry)
    ))) {
      identities.push({ operationId: entry.operationId, scope: entry })
    }
  }

  return identities
}

function hasStoredSalesMutationEntry(
  entries: Array<{ operationId: string; scope: SalesPendingMutationScope }>,
  scope: SalesPendingMutationScope,
  operationId?: string,
): boolean {
  return entries.some((entry) => (
    matchesScope(entry.scope, scope) && (!operationId || entry.operationId === operationId)
  ))
}

function isExpiredResolution(resolvedAt: number | undefined, now: number): boolean {
  return typeof resolvedAt === 'number' && Number.isFinite(resolvedAt) &&
    now - resolvedAt >= SALES_MUTATION_RESOLUTION_RETENTION_MS
}

function readLegacyRegistry(): SalesPendingMutationEntry[] {
  const storage = getLegacyStorageOrThrow()
  const raw = getStorageItemStrict(storage, LEGACY_SESSION_STORAGE_KEY)

  if (!raw) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    persistCorruptionForRawKey(LEGACY_SESSION_STORAGE_KEY, 'Legacy JSON parse error', true)
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    persistCorruptionForRawKey(LEGACY_SESSION_STORAGE_KEY, 'Invalid legacy registry schema', true)
  }

  return parsed.entries.map((entry) => {
    const normalized = normalizeStoredEntry(entry)

    if (!normalized) {
      persistCorruptionForRawKey(LEGACY_SESSION_STORAGE_KEY, 'Invalid legacy entry schema', true)
    }

    return normalized
  })
}

function normalizeStoredEntry(value: unknown): SalesPendingMutationEntry | null {
  if (!isRecord(value)) {
    return null
  }

  const scope = tryNormalizeScope(value)
  const operationId = typeof value.operationId === 'string'
    ? tryNormalizeOperationId(value.operationId)
    : null

  if (
    !scope || !operationId || typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) ||
    typeof value.resumable !== 'boolean' || !('payload' in value)
  ) {
    return null
  }

  const phase = value.phase === 'prepared' || value.phase === 'submitted' || value.phase === 'unknown'
    ? value.phase
    : 'unknown'
  const generation = typeof value.generation === 'number' && Number.isInteger(value.generation) && value.generation >= 0
    ? value.generation
    : 0
  const ownerId = typeof value.ownerId === 'string' && normalizeIdentity(value.ownerId)
    ? normalizeIdentity(value.ownerId)
    : `legacy:${operationId}`
  const fencingToken = typeof value.fencingToken === 'string' && normalizeIdentity(value.fencingToken)
    ? value.fencingToken
    : `legacy:${operationId}`
  const ownerUpdatedAt = typeof value.ownerUpdatedAt === 'number' && Number.isFinite(value.ownerUpdatedAt)
    ? value.ownerUpdatedAt
    : value.createdAt

  return freezeEntry({
    ...scope,
    createdAt: value.createdAt,
    expiresAt: null,
    fencingToken,
    generation,
    operationId,
    ownerId,
    ownerUpdatedAt,
    payload: cloneJson(value.payload),
    phase,
    resumable: value.resumable,
    version: REGISTRY_VERSION,
  })
}

function writeEntry(entry: SalesPendingMutationEntry, required: boolean): void {
  const storage = getStorageOrThrow()
  writeJson(storage, getEntryStorageKey(entry), entry, required)
  const legacyKey = getLegacyEntryStorageKey(entry)

  if (getStorageItemStrict(storage, legacyKey) !== null) {
    removeStorageItemRequired(storage, legacyKey)
  }
}

function removeEntry(entry: SalesPendingMutationEntry): void {
  const storage = getStorageOrThrow()
  removeStorageItemRequired(storage, getEntryStorageKey(entry))
  const legacyKey = getLegacyEntryStorageKey(entry)

  if (getStorageItemStrict(storage, legacyKey) !== null) {
    removeStorageItemRequired(storage, legacyKey)
  }

  clearLegacyEntries(entry, entry.operationId)
}

function readControl(scope: SalesPendingMutationScope): SalesMutationControl | null {
  const key = getControlStorageKey(scope)
  const raw = getStorageItemStrict(getStorageOrThrow(), key)

  if (raw === null) {
    return null
  }

  const parsed = parseJsonOrCorrupt(raw, key)

  if (!isSalesMutationControl(parsed) || !matchesScope(parsed, scope)) {
    persistCorruptionForRawKey(key, 'Invalid mutation control schema')
  }

  return parsed
}

function observeSalesMutationControl(
  scope: SalesPendingMutationScope,
): SalesMutationControlObservation {
  const control = readControl(scope)

  return control
    ? {
        fencingToken: control.fencingToken,
        generation: control.generation,
        operationId: control.operationId,
        state: control.state,
      }
    : null
}

function hasSameControlObservation(
  control: SalesMutationControl | null,
  observation: SalesMutationControlObservation,
): boolean {
  if (!control || !observation) {
    return control === observation
  }

  return control.state === observation.state &&
    control.operationId === observation.operationId &&
    control.generation === observation.generation &&
    control.fencingToken === observation.fencingToken
}

function writeControl(control: SalesMutationControl): void {
  writeJson(getStorageOrThrow(), getControlStorageKey(control), control, true)
}

function readTombstone(
  scope: SalesPendingMutationScope,
  operationId: string,
): SalesMutationTombstone | null {
  const key = getTombstoneStorageKey(scope, operationId)
  const raw = getStorageItemStrict(getStorageOrThrow(), key)

  if (raw === null) {
    return null
  }

  const parsed = parseJsonOrCorrupt(raw, key)

  if (!isSalesMutationTombstone(parsed) || !matchesScope(parsed, scope) || parsed.operationId !== operationId) {
    persistCorruptionForRawKey(key, 'Invalid mutation tombstone schema')
  }

  return parsed
}

function writeTombstone(tombstone: SalesMutationTombstone): void {
  writeJson(
    getStorageOrThrow(),
    getTombstoneStorageKey(tombstone, tombstone.operationId),
    tombstone,
    true,
  )
}

function readCorruptions(): SalesMutationCorruption[] {
  const storage = getStorageOrThrow()
  const values: SalesMutationCorruption[] = []

  for (const key of listStorageKeysStrict(storage)) {
    if (!key.startsWith(CORRUPTION_STORAGE_PREFIX)) {
      continue
    }

    const raw = getStorageItemStrict(storage, key)

    if (raw === null) {
      continue
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new SalesPendingMutationCorruptionError('Corruption sentinel itself is unreadable.')
    }

    if (!isSalesMutationCorruption(parsed)) {
      throw new SalesPendingMutationCorruptionError('Corruption sentinel schema is invalid.')
    }

    values.push(parsed)
  }

  return values
}

function assertNoCorruption(scope: SalesPendingMutationScope, operationId: string | null = null): void {
  const match = readCorruptions().find((corruption) => (
    corruption.scope === null ||
    (matchesScope(corruption.scope, scope) && (!corruption.operationId || corruption.operationId === operationId))
  ))

  if (match) {
    throw new SalesPendingMutationCorruptionError(match.reason)
  }
}

function assertNoCorruptionForUser(userKey: string): void {
  const match = readCorruptions().find((corruption) => (
    corruption.scope === null || corruption.scope.userKey === userKey
  ))

  if (match) {
    throw new SalesPendingMutationCorruptionError(match.reason)
  }
}

function assertOperationNotTombstoned(scope: SalesPendingMutationScope, operationId: string): void {
  if (readTombstone(scope, operationId)) {
    throw new SalesPendingMutationFenceError('Цей operationId вже закритий tombstone і не може бути відновлений застарілою вкладкою.')
  }
}

function writeCorruption(corruption: SalesMutationCorruption): void {
  const key = `${CORRUPTION_STORAGE_PREFIX}${encodeURIComponent(`${corruption.sourceKey}\u001f${corruption.detectedAt}`)}`
  writeJson(getStorageOrThrow(), key, corruption, true)
}

function persistCorruptionForRawKey(key: string, reason: string, legacy = false): never {
  const identity = legacy ? null : parseIdentityFromStorageKey(key)
  writeCorruption({
    detectedAt: Date.now(),
    operationId: identity?.operationId ?? null,
    reason,
    scope: identity?.scope ?? null,
    sourceKey: key,
    version: CONTROL_VERSION,
  })
  throw new SalesPendingMutationCorruptionError(reason)
}

function createClaim(
  scope: SalesPendingMutationScope,
  operationId: string,
  ownerId: string,
  now: number,
): SalesMutationClaim {
  return {
    ...scope,
    claimId: createRandomId('claim'),
    createdAt: now,
    expiresAt: now + FALLBACK_CLAIM_TTL_MS,
    operationId,
    ownerId,
    version: CONTROL_VERSION,
  }
}

function writeClaim(claim: SalesMutationClaim): void {
  writeJson(getStorageOrThrow(), getClaimStorageKey(claim), claim, true)
}

function removeClaim(claim: SalesMutationClaim): void {
  removeStorageItemRequired(getStorageOrThrow(), getClaimStorageKey(claim))
}

function readClaimsForScope(scope: SalesPendingMutationScope, now: number): SalesMutationClaim[] {
  const storage = getStorageOrThrow()
  const claims: SalesMutationClaim[] = []

  for (const key of listStorageKeysStrict(storage)) {
    if (!key.startsWith(`${CLAIM_STORAGE_PREFIX}${encodeScope(scope)}:`)) {
      continue
    }

    const raw = getStorageItemStrict(storage, key)

    if (raw === null) {
      continue
    }

    const parsed = parseJsonOrCorrupt(raw, key)

    if (!isSalesMutationClaim(parsed) || !matchesScope(parsed, scope)) {
      persistCorruptionForRawKey(key, 'Invalid fallback claim schema')
    }

    if (parsed.expiresAt > now) {
      claims.push(parsed)
    } else {
      removeStorageItemRequired(storage, key)
    }
  }

  return claims
}

function installStorageListener(): void {
  if (storageListenerInstalled || typeof window === 'undefined') {
    return
  }

  window.addEventListener('storage', handleStorageEvent)
  storageListenerInstalled = true
}

function uninstallStorageListener(): void {
  if (!storageListenerInstalled || typeof window === 'undefined') {
    return
  }

  window.removeEventListener('storage', handleStorageEvent)
  storageListenerInstalled = false
}

function handleStorageEvent(event: StorageEvent): void {
  if (event.key === null || isSalesMutationStorageKey(event.key)) {
    notifySubscribers(event.key, true)
  }
}

function notifySubscribers(key: string | null, external = false): void {
  for (const listener of pendingMutationListeners) {
    listener({ external, key })
  }
}

function isSalesMutationStorageKey(key: string): boolean {
  return [
    ENTRY_STORAGE_PREFIX,
    LEGACY_ENTRY_STORAGE_PREFIX,
    CONTROL_STORAGE_PREFIX,
    TOMBSTONE_STORAGE_PREFIX,
    CORRUPTION_STORAGE_PREFIX,
    CLAIM_STORAGE_PREFIX,
  ].some((prefix) => key.startsWith(prefix))
}

function writeJson(storage: Storage, key: string, value: unknown, required: boolean): void {
  try {
    storage.setItem(key, JSON.stringify(value))
    notifySubscribers(key)
  } catch {
    if (required) {
      throw new SalesPendingMutationStorageError()
    }
  }
}

function getStorageItemStrict(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    throw new SalesPendingMutationStorageError()
  }
}

function removeStorageItemRequired(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
    notifySubscribers(key)
  } catch {
    throw new SalesPendingMutationStorageError()
  }
}

function listStorageKeysStrict(storage: Storage): string[] {
  try {
    const keys: string[] = []

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)

      if (key === null) {
        throw new Error('Storage enumeration returned a missing key')
      }

      keys.push(key)
    }

    return keys
  } catch {
    throw new SalesPendingMutationStorageError()
  }
}

function getStorageOrThrow(): Storage {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage unavailable')
    }

    return window.localStorage
  } catch {
    throw new SalesPendingMutationStorageError()
  }
}

function getLegacyStorageOrThrow(): Storage {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      throw new Error('sessionStorage unavailable')
    }

    return window.sessionStorage
  } catch {
    throw new SalesPendingMutationStorageError()
  }
}

function getSalesMutationTabOwnerId(): string {
  const storage = getLegacyStorageOrThrow()

  try {
    const existing = normalizeIdentity(storage.getItem(TAB_OWNER_SESSION_KEY))

    if (existing) {
      return `${existing}:${TAB_OWNER_RUNTIME_ID}`
    }

    const created = createRandomId('tab')
    storage.setItem(TAB_OWNER_SESSION_KEY, created)
    return `${created}:${TAB_OWNER_RUNTIME_ID}`
  } catch {
    throw new SalesPendingMutationStorageError()
  }
}

function getWebLocksManager(): LockManager | null {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.locks !== 'undefined'
      ? navigator.locks
      : null
  } catch {
    return null
  }
}

function getEntryStorageKey(entry: Pick<SalesPendingMutationEntry, 'context' | 'kind' | 'operationId' | 'userKey'>): string {
  return `${ENTRY_STORAGE_PREFIX}${encodeOperationIdentity(entry, entry.operationId)}`
}

function getLegacyEntryStorageKey(entry: Pick<SalesPendingMutationEntry, 'context' | 'kind' | 'operationId' | 'userKey'>): string {
  return `${LEGACY_ENTRY_STORAGE_PREFIX}${encodeOperationIdentity(entry, entry.operationId)}`
}

function getControlStorageKey(scope: SalesPendingMutationScope): string {
  return `${CONTROL_STORAGE_PREFIX}${encodeScope(scope)}`
}

function getTombstoneStorageKey(scope: SalesPendingMutationScope, operationId: string): string {
  return `${TOMBSTONE_STORAGE_PREFIX}${encodeOperationIdentity(scope, operationId)}`
}

function getClaimStorageKey(claim: SalesMutationClaim): string {
  return `${CLAIM_STORAGE_PREFIX}${encodeScope(claim)}:${encodeURIComponent(claim.claimId)}`
}

function encodeScope(scope: SalesPendingMutationScope): string {
  return encodeURIComponent([scope.userKey, scope.kind, scope.context].join('\u001f'))
}

function encodeOperationIdentity(scope: SalesPendingMutationScope, operationId: string): string {
  return encodeURIComponent([scope.userKey, scope.kind, scope.context, operationId].join('\u001f'))
}

function parseIdentityFromStorageKey(key: string): {
  operationId: string
  scope: SalesPendingMutationScope
} | null {
  const prefix = key.startsWith(ENTRY_STORAGE_PREFIX)
    ? ENTRY_STORAGE_PREFIX
    : key.startsWith(LEGACY_ENTRY_STORAGE_PREFIX)
      ? LEGACY_ENTRY_STORAGE_PREFIX
      : null

  if (!prefix) {
    return null
  }

  try {
    const [userKey, kind, context, operationId] = decodeURIComponent(key.slice(prefix.length)).split('\u001f')
    const scope = tryNormalizeScope({ context, kind, userKey })
    const normalizedOperationId = tryNormalizeOperationId(operationId)
    return scope && normalizedOperationId ? { operationId: normalizedOperationId, scope } : null
  } catch {
    return null
  }
}

function clearLegacyEntries(scope: SalesPendingMutationScope, operationId: string | null): void {
  const storage = getLegacyStorageOrThrow()
  const raw = getStorageItemStrict(storage, LEGACY_SESSION_STORAGE_KEY)

  if (!raw) {
    return
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    persistCorruptionForRawKey(LEGACY_SESSION_STORAGE_KEY, 'Legacy JSON parse error', true)
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    persistCorruptionForRawKey(LEGACY_SESSION_STORAGE_KEY, 'Invalid legacy registry schema', true)
  }

  const retained = parsed.entries.filter((value) => {
    const entry = normalizeStoredEntry(value)

    if (!entry) {
      persistCorruptionForRawKey(LEGACY_SESSION_STORAGE_KEY, 'Invalid legacy entry schema', true)
    }

    return !matchesScope(entry, scope) || (operationId !== null && entry.operationId !== operationId)
  })

  if (retained.length === 0) {
    removeStorageItemRequired(storage, LEGACY_SESSION_STORAGE_KEY)
  } else {
    writeJson(storage, LEGACY_SESSION_STORAGE_KEY, { entries: retained, version: 1 }, true)
  }
}

function parseJsonOrCorrupt(raw: string, key: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    persistCorruptionForRawKey(key, 'JSON parse error')
  }
}

function normalizeScope(scope: SalesPendingMutationScope): SalesPendingMutationScope {
  const normalized = tryNormalizeScope(scope)

  if (!normalized) {
    throw new Error('Pending sales mutation requires a valid context, kind, and authenticated user')
  }

  return normalized
}

function tryNormalizeScope(value: Record<string, unknown>): SalesPendingMutationScope | null {
  const context = typeof value.context === 'string' ? normalizeIdentity(value.context) : ''
  const userKey = typeof value.userKey === 'string' ? normalizeIdentity(value.userKey) : ''
  const kind = value.kind as SalesPendingMutationKind

  return context && userKey && SALES_PENDING_MUTATION_KINDS.includes(kind)
    ? { context, kind, userKey }
    : null
}

function tryNormalizeOperationId(value: unknown): string | null {
  if (typeof value !== 'string' || !normalizeIdentity(value)) {
    return null
  }

  try {
    return normalizeSalesOperationNetUid(value)
  } catch {
    return null
  }
}

function matchesScope(entry: SalesPendingMutationScope, scope: SalesPendingMutationScope): boolean {
  return entry.context === scope.context && entry.kind === scope.kind && entry.userKey === scope.userKey
}

function toFence(value: SalesPendingMutationFence): SalesPendingMutationFence {
  return {
    context: value.context,
    fencingToken: value.fencingToken,
    generation: value.generation,
    kind: value.kind,
    operationId: value.operationId,
    ownerId: value.ownerId,
    userKey: value.userKey,
  }
}

function assertSameFrozenPayload(left: unknown, right: unknown): void {
  if (stableJson(left) !== stableJson(right)) {
    throw new SalesPendingMutationConflictError('Повтор операції має використовувати точний збережений payload без змін UI.')
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function isSalesMutationControl(value: unknown): value is SalesMutationControl {
  return isRecord(value) && value.version === CONTROL_VERSION &&
    (value.state === 'active' || value.state === 'resolved') &&
    typeof value.generation === 'number' && Number.isInteger(value.generation) && value.generation > 0 &&
    typeof value.fencingToken === 'string' && Boolean(normalizeIdentity(value.fencingToken)) &&
    typeof value.operationId === 'string' && Boolean(tryNormalizeOperationId(value.operationId)) &&
    typeof value.ownerId === 'string' && Boolean(normalizeIdentity(value.ownerId)) &&
    typeof value.ownerUpdatedAt === 'number' && Number.isFinite(value.ownerUpdatedAt) &&
    typeof value.leaseUntil === 'number' && Number.isFinite(value.leaseUntil) &&
    Boolean(tryNormalizeScope(value)) &&
    (value.phase === 'prepared' || value.phase === 'submitted' || value.phase === 'unknown' || value.phase === 'resolved')
}

function isSalesMutationTombstone(value: unknown): value is SalesMutationTombstone {
  return isRecord(value) && value.version === CONTROL_VERSION &&
    typeof value.generation === 'number' && Number.isInteger(value.generation) && value.generation >= 0 &&
    typeof value.fencingToken === 'string' && typeof value.operationId === 'string' &&
    typeof value.ownerId === 'string' && typeof value.resolvedAt === 'number' &&
    (value.resolution === 'committed' || value.resolution === 'manual-committed' || value.resolution === 'not-submitted') &&
    Boolean(tryNormalizeScope(value))
}

function isSalesMutationCorruption(value: unknown): value is SalesMutationCorruption {
  return isRecord(value) && value.version === CONTROL_VERSION &&
    typeof value.detectedAt === 'number' && typeof value.reason === 'string' &&
    typeof value.sourceKey === 'string' &&
    (value.operationId === null || typeof value.operationId === 'string') &&
    (value.scope === null || (isRecord(value.scope) && Boolean(tryNormalizeScope(value.scope))))
}

function isSalesMutationClaim(value: unknown): value is SalesMutationClaim {
  return isRecord(value) && value.version === CONTROL_VERSION &&
    typeof value.claimId === 'string' && typeof value.createdAt === 'number' &&
    typeof value.expiresAt === 'number' && typeof value.operationId === 'string' &&
    typeof value.ownerId === 'string' && Boolean(tryNormalizeScope(value))
}

function freezeEntry<TPayload>(entry: SalesPendingMutationEntry<TPayload>): SalesPendingMutationEntry<TPayload> {
  return deepFreeze(entry)
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)
  Object.values(value).forEach(deepFreeze)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeIdentity(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function createFencingToken(generation: number): string {
  return `${generation}:${createRandomId('fence')}`
}

function createRandomId(prefix: string): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}:${id.toLowerCase()}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
