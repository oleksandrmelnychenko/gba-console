import { getSaleById } from '../../api/salesUkraineApi'
import {
  loadSalesPendingMutationByOperation,
  markSalesPendingMutationCorrupt,
  markSalesPendingMutationSubmitted,
  markSalesPendingMutationUnknown,
  resolveSalesPendingMutation,
  withSalesPendingMutationLock,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import { roundMoney } from '../../saleMoney'
import type { SalesUkraineOrderItem, SalesUkraineSale, SalesUkraineUser } from '../../types'
import {
  assertWizardSplitRecoveryOperationFence,
  commitWizardSplitExtraction,
  getWizardSplitRecovery,
  hydrateWizardSplitRecovery,
  markWizardSplitExtractionSubmitted,
  markWizardSplitExtractionUnknown,
  setWizardSplitOrderItems,
} from './newSaleWizardState'
import {
  createPersistedWizardCartMutation,
  executeWizardCartMutationRequest,
  isPersistedWizardCartMutation,
  type PersistedWizardCartMutation,
  type WizardCartMutationRequest,
} from './wizardCartMutation'
import {
  createWizardOperationId,
  inspectWizardCartMutation,
  type WizardCartMutationExpectation,
} from './wizardMutationOperation'
import { getWizardProductNumber, type WizardSaleProduct } from './wizardSaleProduct'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

export type WizardSplitOrderItem = SalesUkraineOrderItem & {
  Product: WizardSaleProduct
  Qty: number
  RestoreAttempted?: boolean
  RestoreMutation?: WizardSplitMutationSnapshot
  RestoreOperationNetUid?: string
  TotalAmount: number
  TotalAmountEurToUah: number
  TotalAmountLocal: number
}

export type WizardSplitRecoverySource = {
  agreementNetId: string
  origin: 'merged' | 'ordinary'
  saleNetUid: string
  userKey: string
}

export type WizardSplitRecoveryRunResult = {
  changed: boolean
  error: unknown | null
  sale: SalesUkraineSale | null
  source: WizardSplitRecoverySource | null
  succeeded: boolean
}

export type WizardSplitMutationSnapshot = {
  expectation: WizardCartMutationExpectation
  operationId: string
  request: WizardCartMutationRequest
}

export type WizardPendingSplitExtraction = {
  fallbackItems: WizardSplitOrderItem[]
  mutation: WizardSplitMutationSnapshot
  phase: 'prepared' | 'submitted' | 'unknown'
}

export type WizardSplitDurableRestoreResult = {
  error: unknown | null
  remaining: WizardSplitOrderItem[]
  restored: WizardSplitOrderItem[]
}

export type WizardSplitExtractionResolution =
  | { status: 'committed' }
  | { error: unknown; status: 'pending' }

export type WizardSplitRestoreProgress = {
  committed: WizardSplitOrderItem[]
  remaining: WizardSplitOrderItem[]
}

export type WizardSplitRestoreResult = WizardSplitRestoreProgress & {
  error: unknown | null
  reconciliationError: unknown | null
}

export type WizardSplitRestoreFailureResolution = 'committed' | 'definitive' | 'pending'

type WizardSplitSourceOrderItem = SalesUkraineOrderItem & {
  Product: WizardSaleProduct
}

export function addWizardSplitOrderItem(
  items: WizardSplitOrderItem[],
  source: WizardSplitSourceOrderItem,
  qty: number,
  comment: string | undefined,
  fallbackUser?: SalesUkraineUser,
): WizardSplitOrderItem[] {
  const candidate = createWizardSplitOrderItem(source, qty, comment, fallbackUser)
  const existingIndex = items.findIndex((item) => hasSameWizardOrderItemIdentity(item, candidate))

  if (existingIndex < 0) {
    return [...items, candidate]
  }

  const next = [...items]
  const existing = next[existingIndex] as WizardSplitOrderItem
  next[existingIndex] = resizeWizardSplitOrderItem(existing, existing.Qty + qty)

  return next
}

export function createWizardSplitOrderItem(
  source: WizardSplitSourceOrderItem,
  qty: number,
  comment: string | undefined,
  fallbackUser?: SalesUkraineUser,
): WizardSplitOrderItem {
  const sourceQty = getWizardProductNumber(source.Qty) ?? 0
  const item: WizardSplitOrderItem = {
    AssignedSpecification: source.AssignedSpecification,
    Comment: comment ?? source.Comment ?? '',
    Deleted: false,
    Discount: source.Discount,
    Id: 0,
    IsFromReSale: source.IsFromReSale,
    NetUid: EMPTY_GUID,
    OneTimeDiscount: source.OneTimeDiscount,
    OneTimeDiscountComment: source.OneTimeDiscountComment,
    PricePerItem: source.PricePerItem,
    Product: source.Product,
    Qty: qty,
    SourceOrderItemNetUid: getSourceOrderItemNetUid(source),
    TotalAmount: scaleOrderItemTotal(source.TotalAmount, sourceQty, qty, source.Product.CurrentPrice),
    TotalAmountEurToUah: scaleOrderItemTotal(
      source.TotalAmountEurToUah,
      sourceQty,
      qty,
      source.Product.CurrentPriceEurToUah,
    ),
    TotalAmountLocal: scaleOrderItemTotal(source.TotalAmountLocal, sourceQty, qty, source.Product.CurrentLocalPrice),
    TotalVat: scaleOptionalOrderItemTotal(source.TotalVat, sourceQty, qty),
    User: source.User ?? fallbackUser,
  }

  return item
}

export function resizeWizardSplitOrderItem(item: WizardSplitOrderItem, qty: number): WizardSplitOrderItem {
  return {
    ...item,
    Qty: qty,
    TotalAmount: scaleOrderItemTotal(item.TotalAmount, item.Qty, qty, item.Product.CurrentPrice),
    TotalAmountEurToUah: scaleOrderItemTotal(
      item.TotalAmountEurToUah,
      item.Qty,
      qty,
      item.Product.CurrentPriceEurToUah,
    ),
    TotalAmountLocal: scaleOrderItemTotal(item.TotalAmountLocal, item.Qty, qty, item.Product.CurrentLocalPrice),
    TotalVat: scaleOptionalOrderItemTotal(item.TotalVat, item.Qty, qty),
  }
}

export function updateWizardSplitOrderItemQty(
  items: WizardSplitOrderItem[],
  target: WizardSplitOrderItem,
  qty: number,
): WizardSplitOrderItem[] {
  const index = items.findIndex((item) => hasSameWizardOrderItemIdentity(item, target))

  if (index < 0) {
    return items
  }

  if (qty <= 0) {
    return items.filter((_, itemIndex) => itemIndex !== index)
  }

  return items.map((item, itemIndex) => (itemIndex === index ? resizeWizardSplitOrderItem(item, qty) : item))
}

export function ensureWizardSplitRestoreOperationNetUids(
  items: WizardSplitOrderItem[],
  createOperationId: () => string = createWizardOperationId,
): WizardSplitOrderItem[] {
  return items.map((item) =>
    item.RestoreOperationNetUid
      ? item
      : {
          ...item,
          RestoreOperationNetUid: item.RestoreMutation?.operationId ?? createOperationId(),
        },
  )
}

export function stageWizardSplitRestoreMutation(
  items: WizardSplitOrderItem[],
  index: number,
  mutation: WizardSplitMutationSnapshot,
): WizardSplitOrderItem[] {
  const item = items[index]

  if (!item) {
    throw new Error('Cannot stage a restore mutation for a missing split item')
  }

  if (
    item.RestoreOperationNetUid &&
    normalizeNetUid(item.RestoreOperationNetUid) !== normalizeNetUid(mutation.operationId)
  ) {
    throw new Error('Split restore operation id does not match the staged mutation')
  }

  return items.map((candidate, itemIndex) => (
    itemIndex === index
      ? {
          ...candidate,
          RestoreAttempted: true,
          RestoreMutation: mutation,
          RestoreOperationNetUid: mutation.operationId,
        }
      : candidate
  ))
}

export function clearWizardSplitRestoreTracking(
  items: WizardSplitOrderItem[],
  operationId: string,
): WizardSplitOrderItem[] {
  const normalizedOperationId = normalizeNetUid(operationId)

  return items.map((item) => {
    if (normalizeNetUid(item.RestoreOperationNetUid) !== normalizedOperationId) {
      return item
    }

    const retryable = { ...item }
    delete retryable.RestoreAttempted
    delete retryable.RestoreMutation
    delete retryable.RestoreOperationNetUid

    return retryable
  })
}

export function findMergeableWizardOrderItem(
  items: SalesUkraineOrderItem[],
  candidate: WizardSplitOrderItem,
): SalesUkraineOrderItem | undefined {
  return items.find((item) => hasSameWizardOrderItemIdentity(item, candidate))
}

export function findRestorableWizardOrderItem(
  items: SalesUkraineOrderItem[],
  candidate: WizardSplitOrderItem,
): SalesUkraineOrderItem | undefined {
  const sourceNetUid = normalizeNetUid(candidate.SourceOrderItemNetUid)

  if (sourceNetUid) {
    const sourceItem = items.find((item) => normalizeNetUid(item.NetUid) === sourceNetUid)

    if (sourceItem) {
      return sourceItem
    }
  }

  return findMergeableWizardOrderItem(items, candidate)
}

export function hasSameWizardOrderItemIdentity(
  left: SalesUkraineOrderItem,
  right: SalesUkraineOrderItem,
): boolean {
  return getProductIdentity(left) === getProductIdentity(right)
    && getAssignedSpecificationIdentity(left) === getAssignedSpecificationIdentity(right)
    && getOrderItemProvenance(left) === getOrderItemProvenance(right)
    && Boolean(left.IsFromReSale) === Boolean(right.IsFromReSale)
    && getDiscountIdentity(left.Discount) === getDiscountIdentity(right.Discount)
    && getDiscountIdentity(left.OneTimeDiscount) === getDiscountIdentity(right.OneTimeDiscount)
    && (left.OneTimeDiscountComment ?? '') === (right.OneTimeDiscountComment ?? '')
    && (left.Comment ?? '') === (right.Comment ?? '')
    && getDiscountIdentity(left.PricePerItem) === getDiscountIdentity(right.PricePerItem)
}

export function toWizardSplitMutationSnapshot(
  operation: Pick<PersistedWizardCartMutation, 'expectation' | 'operationId' | 'request'>,
): WizardSplitMutationSnapshot {
  return {
    expectation: operation.expectation,
    operationId: operation.operationId,
    request: operation.request,
  }
}

export function createWizardSplitRestoreMutation(
  source: WizardSplitRecoverySource,
  item: WizardSplitOrderItem,
  sale: SalesUkraineSale,
  operationId: string,
): WizardSplitMutationSnapshot {
  const existing = findRestorableWizardOrderItem(sale.Order?.OrderItems ?? [], item)
  const existingQty = getWizardProductNumber(existing?.Qty) ?? 0
  const expectation: WizardCartMutationExpectation = existing?.NetUid
    ? {
        afterQty: existingQty + item.Qty,
        beforeQty: existingQty,
        kind: 'row-quantity',
        rowNetUid: existing.NetUid,
      }
    : { kind: 'operation-marker' }
  const request: WizardCartMutationRequest = existing?.NetUid
    ? {
        kind: 'update',
        orderItem: { ...existing, Deleted: false, Qty: existingQty + item.Qty },
      }
    : {
        clientAgreementNetId: source.agreementNetId,
        kind: 'add',
        orderItem: mapWizardSplitOrderItem(item),
        saleNetId: source.saleNetUid,
      }
  const persisted = createPersistedWizardCartMutation({
    context: getWizardMutationContextKey(source.agreementNetId, source.saleNetUid),
    expectation,
    fallbackMessage: '',
    localCommit: { kind: 'none' },
    operationId,
    request,
  })

  return toWizardSplitMutationSnapshot(persisted)
}

export async function resolveWizardPendingSplitExtraction(
  pending: WizardPendingSplitExtraction,
  loadSale: () => Promise<SalesUkraineSale>,
  execute: (mutation: WizardSplitMutationSnapshot) => Promise<void>,
): Promise<WizardSplitExtractionResolution> {
  let sale: SalesUkraineSale

  try {
    sale = await loadSale()
  } catch (error) {
    return { error, status: 'pending' }
  }

  const state = inspectWizardCartMutation(
    sale,
    pending.mutation.operationId,
    pending.mutation.expectation,
  )

  if (state === 'committed') {
    return { status: 'committed' }
  }

  try {
    await execute(pending.mutation)

    return { status: 'committed' }
  } catch (error) {
    try {
      const reconciled = await loadSale()

      if (
        inspectWizardCartMutation(
          reconciled,
          pending.mutation.operationId,
          pending.mutation.expectation,
        ) === 'committed'
      ) {
        return { status: 'committed' }
      }
    } catch (reconciliationError) {
      return { error: reconciliationError, status: 'pending' }
    }

    return { error, status: 'pending' }
  }
}

export async function restoreWizardSplitItemsDurably({
  execute,
  items,
  loadSale,
  onOperationSettled,
  persist,
  source,
}: {
  execute: (mutation: WizardSplitMutationSnapshot) => Promise<void>
  items: WizardSplitOrderItem[]
  loadSale: () => Promise<SalesUkraineSale>
  onOperationSettled?: (mutation: WizardSplitMutationSnapshot) => Promise<void> | void
  persist: (items: WizardSplitOrderItem[]) => void
  source: WizardSplitRecoverySource
}): Promise<WizardSplitDurableRestoreResult> {
  let remaining = ensureWizardSplitRestoreOperationNetUids(items)
  const restored: WizardSplitOrderItem[] = []

  persist(remaining)

  while (remaining.length > 0) {
    let item = remaining[0] as WizardSplitOrderItem
    let mutation = item.RestoreMutation
    let sale: SalesUkraineSale

    try {
      sale = await loadSale()
    } catch (error) {
      return { error, remaining, restored }
    }

    if (mutation) {
      const operationId = normalizeNetUid(item.RestoreOperationNetUid)

      if (!operationId || operationId !== normalizeNetUid(mutation.operationId)) {
        const retryable = clearWizardSplitRestoreTracking(
          [item],
          item.RestoreOperationNetUid ?? mutation.operationId,
        )[0] as WizardSplitOrderItem
        remaining = [retryable, ...remaining.slice(1)]
        persist(remaining)

        return {
          error: new Error('Persisted split restore operation is inconsistent'),
          remaining,
          restored,
        }
      }

      if (inspectWizardCartMutation(sale, mutation.operationId, mutation.expectation) === 'committed') {
        try {
          await onOperationSettled?.(mutation)
        } catch (error) {
          return { error, remaining, restored }
        }

        const next = remaining.slice(1)
        persist(next)
        remaining = next
        restored.push(item)

        continue
      }
    } else {
      const operationId = item.RestoreOperationNetUid as string
      mutation = createWizardSplitRestoreMutation(source, item, sale, operationId)
      remaining = stageWizardSplitRestoreMutation(remaining, 0, mutation)
      item = remaining[0] as WizardSplitOrderItem
      persist(remaining)
    }

    if (!item.RestoreAttempted) {
      remaining = stageWizardSplitRestoreMutation(remaining, 0, mutation)
      item = remaining[0] as WizardSplitOrderItem
      persist(remaining)
    }

    try {
      await execute(mutation)
    } catch (error) {
      try {
        const reconciled = await loadSale()

        if (inspectWizardCartMutation(reconciled, mutation.operationId, mutation.expectation) === 'committed') {
          await onOperationSettled?.(mutation)
          const next = remaining.slice(1)
          persist(next)
          remaining = next
          restored.push(item)

          continue
        }
      } catch (reconciliationError) {
        return { error: reconciliationError, remaining, restored }
      }

      // Once submitted, no transport/status error proves the request was not
      // committed. Keep the exact operation snapshot for idempotent retry.
      return { error, remaining, restored }
    }

    try {
      await onOperationSettled?.(mutation)
    } catch (error) {
      return { error, remaining, restored }
    }

    const next = remaining.slice(1)
    persist(next)
    remaining = next
    restored.push(item)
  }

  return { error: null, remaining, restored }
}

const splitRecoveryRuns = new Map<string, Promise<WizardSplitRecoveryRunResult>>()

async function executeFencedWizardSplitMutation(
  scope: SalesPendingMutationScope,
  mutation: WizardSplitMutationSnapshot,
): Promise<void> {
  const payload = getPersistedWizardSplitMutation(scope, mutation)

  await withSalesPendingMutationLock(
    scope,
    mutation.operationId,
    payload,
    async (lease) => {
      if (!isMatchingPersistedWizardSplitMutation(lease.entry.payload, mutation)) {
        markSalesPendingMutationCorrupt(
          scope,
          lease.operationId,
          'Persisted split mutation no longer matches its recovery snapshot',
        )
      }

      assertWizardSplitRecoveryOperationFence(lease.operationId)
      const frozen = lease.entry.payload as PersistedWizardCartMutation
      markWizardSplitExtractionSubmitted(lease.operationId)
      markSalesPendingMutationSubmitted(lease)

      try {
        await executeWizardCartMutationRequest(frozen.request, lease.operationId)
      } catch (error) {
        markWizardSplitExtractionUnknown(lease.operationId)
        markSalesPendingMutationUnknown(lease)
        throw error
      }

      resolveSalesPendingMutation(lease, 'committed')
    },
  )
}

async function resolveCommittedWizardSplitMutationEvidence(
  scope: SalesPendingMutationScope,
  mutation: WizardSplitMutationSnapshot,
): Promise<void> {
  const existing = loadSalesPendingMutationByOperation(scope, mutation.operationId)

  if (!existing) {
    return
  }

  if (!isMatchingPersistedWizardSplitMutation(existing.payload, mutation)) {
    markSalesPendingMutationCorrupt(
      scope,
      mutation.operationId,
      'Server-committed split mutation does not match its durable request',
    )
  }

  await withSalesPendingMutationLock(
    scope,
    mutation.operationId,
    existing.payload,
    async (lease) => {
      assertWizardSplitRecoveryOperationFence(lease.operationId)
      resolveSalesPendingMutation(lease, 'committed')
    },
  )
}

function getPersistedWizardSplitMutation(
  scope: SalesPendingMutationScope,
  mutation: WizardSplitMutationSnapshot,
): PersistedWizardCartMutation {
  const existing = loadSalesPendingMutationByOperation(scope, mutation.operationId)

  if (existing) {
    if (!isMatchingPersistedWizardSplitMutation(existing.payload, mutation)) {
      markSalesPendingMutationCorrupt(
        scope,
        mutation.operationId,
        'Split recovery request differs from its durable mutation journal',
      )
    }

    return existing.payload as PersistedWizardCartMutation
  }

  return createPersistedWizardCartMutation({
    context: scope.context,
    expectation: mutation.expectation,
    fallbackMessage: '',
    localCommit: { kind: 'none' },
    operationId: mutation.operationId,
    request: mutation.request,
  })
}

function isMatchingPersistedWizardSplitMutation(
  value: unknown,
  mutation: WizardSplitMutationSnapshot,
): value is PersistedWizardCartMutation {
  return isPersistedWizardCartMutation(value) &&
    normalizeNetUid(value.operationId) === normalizeNetUid(mutation.operationId) &&
    JSON.stringify(value.request) === JSON.stringify(mutation.request) &&
    JSON.stringify(value.expectation) === JSON.stringify(mutation.expectation)
}

export function restorePersistedWizardSplitRecovery(
  userKey: string,
): Promise<WizardSplitRecoveryRunResult> {
  const normalizedUserKey = userKey.trim().toLowerCase()
  const running = splitRecoveryRuns.get(normalizedUserKey)

  if (running) {
    return running
  }

  const run = performPersistedWizardSplitRecovery(normalizedUserKey).finally(() => {
    splitRecoveryRuns.delete(normalizedUserKey)
  })
  splitRecoveryRuns.set(normalizedUserKey, run)

  return run
}

async function performPersistedWizardSplitRecovery(
  userKey: string,
): Promise<WizardSplitRecoveryRunResult> {
  if (!userKey) {
    return {
      changed: false,
      error: new Error('Authenticated user is required to restore split items'),
      sale: null,
      source: null,
      succeeded: false,
    }
  }

  let recovery = getWizardSplitRecovery()

  if (recovery?.userKey !== userKey) {
    recovery = hydrateWizardSplitRecovery(userKey)
  }

  if (!recovery) {
    return { changed: false, error: null, sale: null, source: null, succeeded: true }
  }

  if (recovery.finalMutation) {
    return {
      changed: false,
      error: new Error('Фінальна операція продажу ще не звірена; повернення розділених позицій заблоковано'),
      sale: null,
      source: {
        agreementNetId: recovery.agreementNetId,
        origin: recovery.origin,
        saleNetUid: recovery.saleNetUid,
        userKey: recovery.userKey,
      },
      succeeded: false,
    }
  }

  const source: WizardSplitRecoverySource = {
    agreementNetId: recovery.agreementNetId,
    origin: recovery.origin,
    saleNetUid: recovery.saleNetUid,
    userKey: recovery.userKey,
  }
  const pendingScope: SalesPendingMutationScope = {
    context: getWizardMutationContextKey(source.agreementNetId, source.saleNetUid),
    kind: 'cart',
    userKey,
  }
  const loadSourceSale = async () => {
    const sale = await getSaleById(source.saleNetUid)

    if (!sale) {
      throw new Error('Сервер не повернув вихідний рахунок для відновлення')
    }

    return sale
  }
  const executedOperations = new Set<string>()
  const execute = async (mutation: WizardSplitMutationSnapshot) => {
    await executeFencedWizardSplitMutation(pendingScope, mutation)
    executedOperations.add(normalizeNetUid(mutation.operationId))
  }
  let changed = false

  try {
    if (recovery.pendingExtraction) {
      const operationId = recovery.pendingExtraction.mutation.operationId
      const resolution = await resolveWizardPendingSplitExtraction(
        recovery.pendingExtraction,
        loadSourceSale,
        execute,
      )

      if (resolution.status === 'pending') {
        return { changed, error: resolution.error, sale: null, source, succeeded: false }
      }

      if (resolution.status === 'committed') {
        if (!executedOperations.has(normalizeNetUid(operationId))) {
          await resolveCommittedWizardSplitMutationEvidence(
            pendingScope,
            recovery.pendingExtraction.mutation,
          )
        }

        commitWizardSplitExtraction(operationId)
        changed = true
      }

      recovery = getWizardSplitRecovery()
    }

    if (recovery?.items.length) {
      const result = await restoreWizardSplitItemsDurably({
        execute,
        items: recovery.items,
        loadSale: loadSourceSale,
        onOperationSettled: (mutation) => resolveCommittedWizardSplitMutationEvidence(
          pendingScope,
          mutation,
        ),
        persist: (items) => setWizardSplitOrderItems(items, source.agreementNetId, source),
        source,
      })
      changed = changed || result.restored.length > 0

      if (result.error) {
        return { changed, error: result.error, sale: null, source, succeeded: false }
      }
    }

    let sale: SalesUkraineSale | null = null

    try {
      sale = changed ? await loadSourceSale() : null
    } catch {
      // Restoration is durably complete; the next normal grid reload can refresh the snapshot.
    }

    return { changed, error: null, sale, source, succeeded: true }
  } catch (error) {
    return { changed, error, sale: null, source, succeeded: false }
  }
}

export async function commitWizardSplitMutation(
  mutateServer: () => Promise<void>,
  commitLocal: () => void,
): Promise<void> {
  await mutateServer()
  commitLocal()
}

export async function restoreWizardSplitItemsSequentially(
  items: WizardSplitOrderItem[],
  restoreItem: (
    item: WizardSplitOrderItem,
    index: number,
    operationId: string,
    isRetry: boolean,
  ) => Promise<void>,
  onCommitted?: (progress: WizardSplitRestoreProgress) => void,
  reconcileFailure?: (
    item: WizardSplitOrderItem,
    index: number,
    operationId: string,
    error: unknown,
  ) => Promise<WizardSplitRestoreFailureResolution>,
  onAttempting?: (progress: WizardSplitRestoreProgress) => void,
): Promise<WizardSplitRestoreResult> {
  const trackedItems = ensureWizardSplitRestoreOperationNetUids(items)
  const committed: WizardSplitOrderItem[] = []

  for (const [index, item] of trackedItems.entries()) {
    const isRetry = item.RestoreAttempted === true
    const attemptedItem = isRetry ? item : { ...item, RestoreAttempted: true }
    trackedItems[index] = attemptedItem
    const operationId = attemptedItem.RestoreOperationNetUid as string
    onAttempting?.({ committed: [...committed], remaining: trackedItems.slice(index) })

    try {
      await restoreItem(attemptedItem, index, operationId, isRetry)
    } catch (error) {
      let resolution: WizardSplitRestoreFailureResolution = 'pending'
      let reconciliationError: unknown | null = null

      try {
        resolution = reconcileFailure
          ? await reconcileFailure(attemptedItem, index, operationId, error)
          : 'pending'
      } catch (failure) {
        reconciliationError = failure
      }

      if (resolution !== 'committed') {
        if (resolution === 'definitive') {
          const retryableItem = { ...attemptedItem }
          delete retryableItem.RestoreAttempted
          delete retryableItem.RestoreOperationNetUid
          trackedItems[index] = retryableItem
        }

        return { committed, error, reconciliationError, remaining: trackedItems.slice(index) }
      }
    }

    committed.push(attemptedItem)
    onCommitted?.({ committed: [...committed], remaining: trackedItems.slice(index + 1) })
  }

  return { committed, error: null, reconciliationError: null, remaining: [] }
}

export function mapWizardSplitOrderItem(item: WizardSplitOrderItem): SalesUkraineOrderItem {
  return {
    AssignedSpecification: item.AssignedSpecification,
    Comment: item.Comment ?? '',
    Deleted: false,
    Discount: item.Discount,
    Id: 0,
    IsFromReSale: item.IsFromReSale,
    NetUid: EMPTY_GUID,
    OneTimeDiscount: item.OneTimeDiscount,
    OneTimeDiscountComment: item.OneTimeDiscountComment,
    PricePerItem: item.PricePerItem,
    Product: item.Product,
    Qty: item.Qty,
    SourceOrderItemNetUid: item.SourceOrderItemNetUid,
    TotalAmount: item.TotalAmount,
    TotalAmountEurToUah: item.TotalAmountEurToUah,
    TotalAmountLocal: item.TotalAmountLocal,
    TotalVat: item.TotalVat,
    User: item.User,
  }
}

export function buildWizardSplitSale(current: SalesUkraineSale, items: WizardSplitOrderItem[]): SalesUkraineSale {
  return {
    ClientAgreement: current.ClientAgreement,
    CustomersOwnTtn: current.CustomersOwnTtn ?? null,
    Deleted: false,
    Id: 0,
    IsVatSale: current.IsVatSale,
    NetUid: EMPTY_GUID,
    OneTimeDiscountComment: current.OneTimeDiscountComment,
    Order: {
      Deleted: false,
      Id: 0,
      NetUid: EMPTY_GUID,
      OrderItems: items.map(mapWizardSplitOrderItem),
      OrderSource: current.Order?.OrderSource,
    },
    TTN: current.TTN,
  }
}

function getOrderItemProvenance(item: SalesUkraineOrderItem): string {
  return normalizeNetUid(getSourceOrderItemNetUid(item))
}

function getSourceOrderItemNetUid(item: SalesUkraineOrderItem): string | undefined {
  const itemNetUid = item.NetUid?.trim()

  if (normalizeNetUid(itemNetUid)) {
    return itemNetUid
  }

  const sourceNetUid = item.SourceOrderItemNetUid?.trim()

  if (normalizeNetUid(sourceNetUid)) {
    return sourceNetUid
  }

  return undefined
}

export function getWizardMutationContextKey(
  agreementNetId: string | null | undefined,
  saleNetUid: string | null | undefined,
): string {
  return `${normalizeNetUid(agreementNetId)}:${normalizeNetUid(saleNetUid)}`
}

export function isWizardMutationContextCurrent(captured: string, current: string, mounted = true): boolean {
  return mounted && captured === current
}

function getProductIdentity(item: SalesUkraineOrderItem): string {
  const netUid = normalizeNetUid(item.Product?.NetUid)

  return netUid || (item.Product?.Id != null ? `id:${item.Product.Id}` : '')
}

function getAssignedSpecificationIdentity(item: SalesUkraineOrderItem): string {
  const specification = item.AssignedSpecification

  if (!specification) {
    return ''
  }

  return [
    normalizeNetUid(specification.NetUid),
    typeof specification.Id === 'number' && specification.Id > 0 ? String(specification.Id) : '',
    specification.SpecificationCode?.trim() ?? '',
  ].join('|')
}

function normalizeNetUid(value: string | null | undefined): string {
  const netUid = value?.trim().toLowerCase() ?? ''

  return netUid === EMPTY_GUID ? '' : netUid
}

function getDiscountIdentity(value: number | null | undefined): number {
  return getWizardProductNumber(value) ?? 0
}

function scaleOrderItemTotal(
  total: number | undefined,
  sourceQty: number,
  qty: number,
  fallbackUnitPrice: number | undefined,
): number {
  const numericTotal = getWizardProductNumber(total)

  if (numericTotal != null && sourceQty > 0) {
    return roundMoney((numericTotal / sourceQty) * qty)
  }

  return roundMoney(qty * (getWizardProductNumber(fallbackUnitPrice) ?? 0))
}

function scaleOptionalOrderItemTotal(total: number | undefined, sourceQty: number, qty: number): number | undefined {
  const numericTotal = getWizardProductNumber(total)

  return numericTotal != null && sourceQty > 0 ? roundMoney((numericTotal / sourceQty) * qty) : undefined
}
